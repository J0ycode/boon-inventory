-- Purchase bills: payment status (paid / unpaid with a due date), bill amount and the scanned bill file.

alter table public.receipts
  add column payment_status text not null default 'UNPAID' check (payment_status in ('PAID', 'UNPAID')),
  add column payment_due_date date,
  add column paid_at timestamptz,
  add column bill_amount numeric(12, 2) check (bill_amount is null or bill_amount >= 0),
  add column bill_path text,
  add constraint receipts_unpaid_needs_due_date check (payment_status = 'PAID' or payment_due_date is not null);

-- Receipts recorded before this feature are treated as settled.
update public.receipts set payment_status = 'PAID', paid_at = created_at;

create index receipts_unpaid_due_idx on public.receipts (tenant_id, payment_due_date) where payment_status = 'UNPAID';

-- Today's date in the caller's shop timezone.
create function app.tenant_today(p_tenant_id uuid)
returns date
language sql stable security definer set search_path = ''
as $$
  select (now() at time zone coalesce((select timezone from public.tenants where id = p_tenant_id), 'Asia/Kolkata'))::date;
$$;

create function app.check_payment(p_status text, p_due_date date)
returns void
language plpgsql immutable set search_path = ''
as $$
begin
  if p_status is null or p_status not in ('PAID', 'UNPAID') then
    perform app.raise('BB_INVALID_PAYMENT_STATUS', 'Choose whether the bill is paid or unpaid.');
  end if;
  if p_status = 'UNPAID' and p_due_date is null then
    perform app.raise('BB_DUE_DATE_REQUIRED', 'Enter the payment deadline for this unpaid bill.');
  end if;
end;
$$;

-- receive_stock gains the payment details. Same body as before plus the new columns.
drop function public.receive_stock(uuid, text, jsonb, text, uuid);

create function public.receive_stock(
  p_supplier_id uuid,
  p_invoice_number text,
  p_lines jsonb,
  p_note text default null,
  p_idempotency_key uuid default null,
  p_payment_status text default 'PAID',
  p_payment_due_date date default null,
  p_bill_amount numeric default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_profile public.profiles := app.require_user(array['OWNER', 'STOREROOM_MANAGER']::public.app_role[]);
  v_tenant uuid := v_profile.tenant_id;
  v_room uuid := app.store_room_id(v_profile.tenant_id);
  v_prior jsonb;
  v_receipt_id uuid;
  v_number text;
  v_pieces integer := 0;
  v_line record;
  v_result jsonb;
begin
  v_prior := app.idempotency_begin(v_tenant, p_idempotency_key, 'receive_stock');
  if v_prior is not null then
    return v_prior;
  end if;

  if p_supplier_id is null or not exists (
    select 1 from public.suppliers where id = p_supplier_id and tenant_id = v_tenant
  ) then
    perform app.raise('BB_SUPPLIER_REQUIRED', 'Choose the supplier this delivery came from.');
  end if;
  if nullif(trim(p_invoice_number), '') is null then
    perform app.raise('BB_INVOICE_REQUIRED', 'Enter the supplier''s invoice number.');
  end if;
  if exists (
    select 1 from public.receipts
    where tenant_id = v_tenant and supplier_id = p_supplier_id and lower(invoice_number) = lower(trim(p_invoice_number))
  ) then
    perform app.raise('BB_DUPLICATE_INVOICE',
      format('Invoice %s from this supplier was already received. Check before receiving it again.', trim(p_invoice_number)));
  end if;
  perform app.check_payment(p_payment_status, p_payment_due_date);
  if p_bill_amount is not null and (p_bill_amount < 0 or p_bill_amount > 9999999999) then
    perform app.raise('BB_INVALID_AMOUNT', 'Enter a valid bill amount.');
  end if;

  v_number := app.next_document_number(v_tenant, 'RCV');
  insert into public.receipts (tenant_id, number, location_id, supplier_id, invoice_number, note, created_by,
                               payment_status, payment_due_date, paid_at, bill_amount)
  values (v_tenant, v_number, v_room, p_supplier_id, trim(p_invoice_number), nullif(trim(p_note), ''), v_profile.user_id,
          p_payment_status, case when p_payment_status = 'UNPAID' then p_payment_due_date end,
          case when p_payment_status = 'PAID' then now() end, round(p_bill_amount, 2))
  returning id into v_receipt_id;

  for v_line in select * from app.parse_lines(v_tenant, p_lines) loop
    insert into public.receipt_lines (tenant_id, receipt_id, product_id, quantity, unit_cost)
    values (v_tenant, v_receipt_id, v_line.product_id, v_line.quantity, v_line.unit_cost);

    perform app.apply_stock_movement(v_tenant, v_line.product_id, v_room, 'RECEIPT', v_line.quantity,
      'receipt', v_receipt_id, v_number || ' · invoice ' || trim(p_invoice_number));

    if v_line.unit_cost is not null then
      insert into public.product_costs (product_id, tenant_id, cost_price)
      values (v_line.product_id, v_tenant, v_line.unit_cost)
      on conflict (product_id) do update set cost_price = excluded.cost_price
      where public.product_costs.cost_price is distinct from excluded.cost_price;
    end if;
    v_pieces := v_pieces + v_line.quantity;
  end loop;

  perform app.audit(v_tenant, 'receipt.created', 'receipt', v_receipt_id,
    jsonb_build_object('number', v_number, 'invoice', trim(p_invoice_number), 'pieces', v_pieces,
                       'lines', jsonb_array_length(p_lines), 'payment_status', p_payment_status,
                       'payment_due_date', p_payment_due_date, 'bill_amount', p_bill_amount));

  v_result := jsonb_build_object('receipt_id', v_receipt_id, 'number', v_number, 'pieces', v_pieces);
  return app.idempotency_finish(v_tenant, p_idempotency_key, 'receive_stock', v_result);
end;
$$;

-- Mark a bill paid or unpaid, change its deadline or amount.
create function public.set_receipt_payment(
  p_receipt_id uuid,
  p_payment_status text,
  p_payment_due_date date default null,
  p_bill_amount numeric default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_profile public.profiles := app.require_user(array['OWNER', 'STOREROOM_MANAGER']::public.app_role[]);
  v_before public.receipts;
begin
  select * into v_before from public.receipts
  where id = p_receipt_id and tenant_id = v_profile.tenant_id for update;
  if not found then
    perform app.raise('BB_NOT_FOUND', 'This bill was not found.');
  end if;
  perform app.check_payment(p_payment_status, p_payment_due_date);
  if p_bill_amount is not null and (p_bill_amount < 0 or p_bill_amount > 9999999999) then
    perform app.raise('BB_INVALID_AMOUNT', 'Enter a valid bill amount.');
  end if;

  update public.receipts set
    payment_status = p_payment_status,
    payment_due_date = case when p_payment_status = 'UNPAID' then p_payment_due_date else payment_due_date end,
    paid_at = case when p_payment_status = 'PAID' then coalesce(v_before.paid_at, now()) end,
    bill_amount = round(p_bill_amount, 2)
  where id = p_receipt_id;

  perform app.audit(v_profile.tenant_id, 'receipt.payment_updated', 'receipt', p_receipt_id,
    jsonb_build_object('number', v_before.number,
                       'from', jsonb_build_object('status', v_before.payment_status, 'due', v_before.payment_due_date,
                                                  'amount', v_before.bill_amount),
                       'to', jsonb_build_object('status', p_payment_status, 'due', p_payment_due_date,
                                                'amount', p_bill_amount)));
end;
$$;

-- Attach (or replace / remove) the uploaded bill file. Returns the previous path so the caller can delete it.
create function public.set_receipt_bill(p_receipt_id uuid, p_bill_path text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_profile public.profiles := app.require_user(array['OWNER', 'STOREROOM_MANAGER']::public.app_role[]);
  v_before public.receipts;
begin
  select * into v_before from public.receipts
  where id = p_receipt_id and tenant_id = v_profile.tenant_id for update;
  if not found then
    perform app.raise('BB_NOT_FOUND', 'This bill was not found.');
  end if;
  if p_bill_path is not null and (
    split_part(p_bill_path, '/', 1) <> v_profile.tenant_id::text
    or split_part(p_bill_path, '/', 2) <> p_receipt_id::text
    or not exists (select 1 from storage.objects where bucket_id = 'purchase-bills' and name = p_bill_path)
  ) then
    perform app.raise('BB_INVALID_FILE', 'The bill file could not be attached. Upload it again.');
  end if;

  update public.receipts set bill_path = p_bill_path where id = p_receipt_id;
  perform app.audit(v_profile.tenant_id,
    case when p_bill_path is null then 'receipt.bill_removed' else 'receipt.bill_attached' end,
    'receipt', p_receipt_id, jsonb_build_object('number', v_before.number));
  return v_before.bill_path;
end;
$$;

revoke execute on function app.tenant_today(uuid), app.check_payment(text, date) from public, anon, authenticated;
revoke execute on function public.receive_stock(uuid, text, jsonb, text, uuid, text, date, numeric) from public, anon;
grant execute on function public.receive_stock(uuid, text, jsonb, text, uuid, text, date, numeric) to authenticated;
revoke execute on function public.set_receipt_payment(uuid, text, date, numeric) from public, anon;
grant execute on function public.set_receipt_payment(uuid, text, date, numeric) to authenticated;
revoke execute on function public.set_receipt_bill(uuid, text) from public, anon;
grant execute on function public.set_receipt_bill(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Bill files: private bucket, path {tenant_id}/{receipt_id}/{file}. Managers only.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('purchase-bills', 'purchase-bills', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy purchase_bills_select on storage.objects for select to authenticated
  using (bucket_id = 'purchase-bills'
         and (storage.foldername(name))[1] = (select app.current_tenant_id())::text
         and (select app.is_manager()));
create policy purchase_bills_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'purchase-bills'
              and (storage.foldername(name))[1] = (select app.current_tenant_id())::text
              and (select app.is_manager()));
create policy purchase_bills_delete on storage.objects for delete to authenticated
  using (bucket_id = 'purchase-bills'
         and (storage.foldername(name))[1] = (select app.current_tenant_id())::text
         and (select app.is_manager()));

-- ---------------------------------------------------------------------------
-- Notifications: managers also see unpaid bills that are overdue or due within 3 days.
-- ---------------------------------------------------------------------------
create or replace function public.notification_summary()
returns jsonb
language plpgsql stable security invoker set search_path = ''
as $$
declare
  v_role public.app_role := app.current_app_role();
  v_locations uuid[] := app.visible_location_ids();
  v_room uuid;
  v_today date;
begin
  if v_role is null then
    return '{}'::jsonb;
  end if;
  if v_role = 'STORE_STAFF' then
    return jsonb_build_object(
      'low_stock', (select count(*) from public.stock_levels sl join public.products p on p.id = sl.product_id
                    where sl.location_id = any (v_locations) and p.active and p.reorder_level > 0
                      and sl.quantity <= p.reorder_level),
      'incoming', (select count(*) from public.dispatches where status = 'DISPATCHED' and to_location_id = any (v_locations)),
      'suggestions', (select count(*) from public.restock_requests where status = 'WAITING_STAFF_APPROVAL'
                      and location_id = any (v_locations)));
  end if;
  select id into v_room from public.locations where kind = 'STORE_ROOM' and tenant_id = app.current_tenant_id();
  v_today := app.tenant_today(app.current_tenant_id());
  return jsonb_build_object(
    'low_stock', (select count(*) from public.stock_levels sl join public.products p on p.id = sl.product_id
                  where sl.location_id = v_room and p.active and p.reorder_level > 0 and sl.quantity <= p.reorder_level),
    'requests', (select count(*) from public.restock_requests where status = 'SENT'),
    'returns', (select count(*) from public.return_damage_entries where status = 'PENDING'),
    'discrepancies', (select count(*) from public.dispatches where status = 'RECEIVED_WITH_ISSUES'),
    'bills_overdue', (select count(*) from public.receipts where payment_status = 'UNPAID' and payment_due_date < v_today),
    'bills_due_soon', (select count(*) from public.receipts where payment_status = 'UNPAID'
                       and payment_due_date between v_today and v_today + 3));
end;
$$;

-- notification_summary is security invoker; managers need tenant_today.
grant execute on function app.tenant_today(uuid) to authenticated;
