-- Phase 3: receiving supplier deliveries into the Store Room.

-- Validates a lines payload [{product_id, quantity, ...}] for the caller's tenant: non-empty, whole positive
-- quantities, known active products, no product listed twice. Returns the lines as a typed set.
create function app.parse_lines(p_tenant_id uuid, p_lines jsonb, p_allow_inactive boolean default false)
returns table (product_id uuid, quantity integer, unit_cost numeric, product_name text)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    perform app.raise('BB_NO_LINES', 'Add at least one product.');
  end if;
  if jsonb_array_length(p_lines) > 500 then
    perform app.raise('BB_TOO_MANY_LINES', 'A single document can have up to 500 products.');
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_lines) l
    where coalesce(l ->> 'product_id', '') !~ '^[0-9a-fA-F-]{36}$'
  ) then
    perform app.raise('BB_PRODUCT_NOT_FOUND', 'One of the products was not found or is inactive.');
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_lines) l
    where jsonb_typeof(l -> 'quantity') <> 'number'
       or (l ->> 'quantity')::numeric <> trunc((l ->> 'quantity')::numeric)
       or (l ->> 'quantity')::numeric <= 0
       or (l ->> 'quantity')::numeric > 100000
  ) then
    perform app.raise('BB_INVALID_QUANTITY', 'Quantities must be whole numbers between 1 and 100,000.');
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_lines) l
    where l ? 'unit_cost' and jsonb_typeof(l -> 'unit_cost') = 'number' and (l ->> 'unit_cost')::numeric < 0
  ) then
    perform app.raise('BB_INVALID_COST', 'Costs cannot be negative.');
  end if;
  select count(*) - count(distinct l ->> 'product_id') into v_count from jsonb_array_elements(p_lines) l;
  if v_count > 0 then
    perform app.raise('BB_DUPLICATE_LINE', 'A product is listed more than once. Combine the quantities into one line.');
  end if;

  return query
    select p.id, (l ->> 'quantity')::integer,
           case when jsonb_typeof(l -> 'unit_cost') = 'number' then round((l ->> 'unit_cost')::numeric, 2) end,
           p.name
    from jsonb_array_elements(p_lines) l
    left join public.products p on p.id = (l ->> 'product_id')::uuid and p.tenant_id = p_tenant_id;

  if exists (
    select 1 from jsonb_array_elements(p_lines) l
    left join public.products p on p.id = (l ->> 'product_id')::uuid and p.tenant_id = p_tenant_id
    where p.id is null or (not p_allow_inactive and not p.active)
  ) then
    perform app.raise('BB_PRODUCT_NOT_FOUND', 'One of the products was not found or is inactive.');
  end if;
end;
$$;

-- Receive a supplier delivery into the Store Room.
-- p_lines: [{product_id, quantity, unit_cost?}]. A given unit_cost also becomes the product's cost price.
create function public.receive_stock(
  p_supplier_id uuid,
  p_invoice_number text,
  p_lines jsonb,
  p_note text default null,
  p_idempotency_key uuid default null
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

  v_number := app.next_document_number(v_tenant, 'RCV');
  insert into public.receipts (tenant_id, number, location_id, supplier_id, invoice_number, note, created_by)
  values (v_tenant, v_number, v_room, p_supplier_id, trim(p_invoice_number), nullif(trim(p_note), ''), v_profile.user_id)
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
                       'lines', jsonb_array_length(p_lines)));

  v_result := jsonb_build_object('receipt_id', v_receipt_id, 'number', v_number, 'pieces', v_pieces);
  return app.idempotency_finish(v_tenant, p_idempotency_key, 'receive_stock', v_result);
end;
$$;

revoke execute on all functions in schema app from public, anon, authenticated;
grant execute on function app.current_tenant_id(), app.current_app_role(), app.is_manager(), app.is_owner(),
  app.visible_location_ids() to authenticated;
revoke execute on function public.receive_stock(uuid, text, jsonb, text, uuid) from public, anon;
grant execute on function public.receive_stock(uuid, text, jsonb, text, uuid) to authenticated;

-- Display names: let documents join to profiles for "created by" (users are deactivated, never deleted).
alter table public.receipts add constraint receipts_created_by_profile_fkey
  foreign key (created_by) references public.profiles (user_id);
alter table public.dispatches add constraint dispatches_created_by_profile_fkey
  foreign key (created_by) references public.profiles (user_id);
alter table public.dispatches add constraint dispatches_received_by_profile_fkey
  foreign key (received_by) references public.profiles (user_id);
alter table public.restock_requests add constraint restock_requests_created_by_profile_fkey
  foreign key (created_by) references public.profiles (user_id);
alter table public.return_damage_entries add constraint return_damage_entries_created_by_profile_fkey
  foreign key (created_by) references public.profiles (user_id);
alter table public.stock_movements add constraint stock_movements_user_profile_fkey
  foreign key (user_id) references public.profiles (user_id);