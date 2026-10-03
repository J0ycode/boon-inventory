-- Phase 6: returns & damaged entries with approval, the sales API (idempotent on external_ref), API keys.

-- ---------------------------------------------------------------------------
-- Returns and damage
-- ---------------------------------------------------------------------------

-- Store staff: RETURN_TO_STOREROOM or DAMAGE at their store → PENDING until a manager approves.
-- Managers at the Store Room: DAMAGE or SUPPLIER_RETURN → applied immediately (they are the approver).
create function public.create_return_damage_entry(
  p_location_id uuid,
  p_type public.return_damage_type,
  p_product_id uuid,
  p_quantity integer,
  p_reason text,
  p_idempotency_key uuid default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_profile public.profiles := app.require_user(array['OWNER', 'STOREROOM_MANAGER', 'STORE_STAFF']::public.app_role[]);
  v_tenant uuid := v_profile.tenant_id;
  v_prior jsonb;
  v_location public.locations;
  v_id uuid;
  v_number text;
  v_on_hand integer;
  v_immediate boolean;
  v_result jsonb;
begin
  v_prior := app.idempotency_begin(v_tenant, p_idempotency_key, 'create_return_damage_entry');
  if v_prior is not null then
    return v_prior;
  end if;

  v_location := app.assert_location_access(v_profile, p_location_id);
  if v_location.kind = 'STORE' and p_type not in ('RETURN_TO_STOREROOM', 'DAMAGE') then
    perform app.raise('BB_INVALID_TYPE', 'Stores can return stock to the Store Room or report damage.');
  end if;
  if v_location.kind = 'STORE_ROOM' and p_type not in ('DAMAGE', 'SUPPLIER_RETURN') then
    perform app.raise('BB_INVALID_TYPE', 'At the Store Room you can record damage or a return to the supplier.');
  end if;
  if v_location.kind = 'STORE_ROOM' and v_profile.role = 'STORE_STAFF' then
    perform app.raise('BB_FORBIDDEN', 'You can only work with your own store.');
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 100000 then
    perform app.raise('BB_INVALID_QUANTITY', 'Quantities must be whole numbers between 1 and 100,000.');
  end if;
  if nullif(trim(p_reason), '') is null then
    perform app.raise('BB_REASON_REQUIRED', 'Give a reason.');
  end if;
  if not exists (select 1 from public.products where id = p_product_id and tenant_id = v_tenant) then
    perform app.raise('BB_PRODUCT_NOT_FOUND', 'That product was not found.');
  end if;
  select coalesce((select quantity from public.stock_levels where location_id = p_location_id and product_id = p_product_id), 0)
  into v_on_hand;
  if p_quantity > v_on_hand then
    perform app.raise('BB_INSUFFICIENT_STOCK',
      format('Only %s in stock here, so you can''t return or write off %s.', v_on_hand, p_quantity));
  end if;

  v_immediate := v_location.kind = 'STORE_ROOM';
  v_number := app.next_document_number(v_tenant, 'RET');
  insert into public.return_damage_entries
    (tenant_id, number, location_id, type, product_id, quantity, reason, status, created_by, decided_by, decided_at)
  values
    (v_tenant, v_number, p_location_id, p_type, p_product_id, p_quantity, trim(p_reason),
     case when v_immediate then 'APPROVED'::public.approval_status else 'PENDING'::public.approval_status end,
     v_profile.user_id,
     case when v_immediate then v_profile.user_id end,
     case when v_immediate then now() end)
  returning id into v_id;

  if v_immediate then
    perform app.apply_stock_movement(v_tenant, p_product_id, p_location_id,
      case p_type when 'SUPPLIER_RETURN' then 'SUPPLIER_RETURN'::public.movement_type else 'DAMAGE'::public.movement_type end,
      -p_quantity, 'return_damage', v_id, v_number || ' · ' || trim(p_reason));
  end if;

  perform app.audit(v_tenant, 'return_damage.created', 'return_damage_entry', v_id,
    jsonb_build_object('number', v_number, 'type', p_type, 'quantity', p_quantity, 'applied', v_immediate));
  v_result := jsonb_build_object('entry_id', v_id, 'number', v_number,
    'status', case when v_immediate then 'APPROVED' else 'PENDING' end);
  return app.idempotency_finish(v_tenant, p_idempotency_key, 'create_return_damage_entry', v_result);
end;
$$;

-- Manager decision on a store's entry. Approve: return → RETURN_OUT at the store + RETURN_IN at the Store Room;
-- damage → DAMAGE at the store. Reject: needs a note; stock unchanged.
create function public.decide_return_damage(
  p_id uuid,
  p_approve boolean,
  p_note text default null,
  p_idempotency_key uuid default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_profile public.profiles := app.require_user(array['OWNER', 'STOREROOM_MANAGER']::public.app_role[]);
  v_tenant uuid := v_profile.tenant_id;
  v_prior jsonb;
  v_entry public.return_damage_entries;
  v_room uuid := app.store_room_id(v_profile.tenant_id);
  v_label text;
  v_result jsonb;
begin
  v_prior := app.idempotency_begin(v_tenant, p_idempotency_key, 'decide_return_damage');
  if v_prior is not null then
    return v_prior;
  end if;
  select * into v_entry from public.return_damage_entries where id = p_id and tenant_id = v_tenant for update;
  if v_entry.id is null then
    perform app.raise('BB_NOT_FOUND', 'That entry was not found.');
  elsif v_entry.status <> 'PENDING' then
    perform app.raise('BB_ALREADY_DECIDED', 'This entry has already been decided.');
  end if;

  if p_approve then
    v_label := v_entry.number || ' · ' || v_entry.reason;
    if v_entry.type = 'RETURN_TO_STOREROOM' then
      perform app.apply_stock_movement(v_tenant, v_entry.product_id, v_entry.location_id, 'RETURN_OUT',
        -v_entry.quantity, 'return_damage', p_id, v_label);
      perform app.apply_stock_movement(v_tenant, v_entry.product_id, v_room, 'RETURN_IN',
        v_entry.quantity, 'return_damage', p_id, v_label);
    else
      perform app.apply_stock_movement(v_tenant, v_entry.product_id, v_entry.location_id, 'DAMAGE',
        -v_entry.quantity, 'return_damage', p_id, v_label);
    end if;
  elsif nullif(trim(p_note), '') is null then
    perform app.raise('BB_NOTE_REQUIRED', 'Tell the store why this is rejected.');
  end if;

  update public.return_damage_entries
  set status = case when p_approve then 'APPROVED'::public.approval_status else 'REJECTED'::public.approval_status end,
      decided_by = v_profile.user_id, decided_at = now(), decision_note = nullif(trim(p_note), '')
  where id = p_id;

  perform app.audit(v_tenant, case when p_approve then 'return_damage.approved' else 'return_damage.rejected' end,
    'return_damage_entry', p_id, jsonb_build_object('number', v_entry.number));
  v_result := jsonb_build_object('entry_id', p_id, 'status', case when p_approve then 'APPROVED' else 'REJECTED' end);
  return app.idempotency_finish(v_tenant, p_idempotency_key, 'decide_return_damage', v_result);
end;
$$;

-- ---------------------------------------------------------------------------
-- Sales
-- ---------------------------------------------------------------------------
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  location_id uuid not null,
  external_ref text not null check (length(external_ref) between 1 and 120),
  source text not null check (source in ('API', 'BILLING')),
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  unique (tenant_id, external_ref),
  unique (tenant_id, id),
  foreign key (tenant_id, location_id) references public.locations (tenant_id, id)
);
create index sales_location_created_idx on public.sales (location_id, created_at desc);

create table public.sale_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  sale_id uuid not null,
  product_id uuid not null,
  barcode text not null,
  quantity integer not null check (quantity > 0),
  foreign key (tenant_id, sale_id) references public.sales (tenant_id, id) on delete cascade,
  foreign key (tenant_id, product_id) references public.products (tenant_id, id)
);
create index sale_lines_tenant_id_idx on public.sale_lines (tenant_id);
create index sale_lines_sale_idx on public.sale_lines (sale_id);
create index sale_lines_product_idx on public.sale_lines (product_id);

alter table public.sales enable row level security;
alter table public.sale_lines enable row level security;
revoke all on public.sales, public.sale_lines from anon, authenticated;
grant select on public.sales, public.sale_lines to authenticated;
create policy sales_select on public.sales for select to authenticated
  using (tenant_id = (select app.current_tenant_id()) and location_id = any ((select app.visible_location_ids())::uuid[]));
create policy sale_lines_select on public.sale_lines for select to authenticated
  using (tenant_id = (select app.current_tenant_id()) and exists (select 1 from public.sales s where s.id = sale_id));

-- The one sale implementation behind both the API and the in-system billing module.
-- p_items: [{barcode, quantity}]. Idempotent on (tenant, external_ref): a repeat returns the original sale.
create function app.record_sale_for_tenant(
  p_tenant_id uuid,
  p_location_id uuid,
  p_external_ref text,
  p_items jsonb,
  p_source text,
  p_user_id uuid
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_ref text := trim(coalesce(p_external_ref, ''));
  v_existing public.sales;
  v_sale_id uuid;
  v_unknown text[];
  v_item record;
  v_lines jsonb := '[]'::jsonb;
  v_after integer;
begin
  perform app.assert_tenant_writable(p_tenant_id);
  if v_ref = '' or length(v_ref) > 120 then
    perform app.raise('BB_INVALID_REQUEST', 'external_ref is required (1–120 characters).');
  end if;

  -- Idempotency: serialise on the reference, then return the original if it exists.
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || ':sale:' || v_ref, 0));
  select * into v_existing from public.sales where tenant_id = p_tenant_id and external_ref = v_ref;
  if v_existing.id is not null then
    return jsonb_build_object('sale_id', v_existing.id, 'external_ref', v_ref, 'duplicate', true,
      'location_id', v_existing.location_id,
      'lines', coalesce((select jsonb_agg(jsonb_build_object('barcode', barcode, 'quantity', quantity))
                         from public.sale_lines where sale_id = v_existing.id), '[]'::jsonb));
  end if;

  if not exists (select 1 from public.locations where id = p_location_id and tenant_id = p_tenant_id and kind = 'STORE' and active) then
    perform app.raise('BB_LOCATION_NOT_FOUND', 'location_id is not an active store of this shop.');
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    perform app.raise('BB_INVALID_REQUEST', 'items must be a non-empty array.');
  end if;
  if jsonb_array_length(p_items) > 500 then
    perform app.raise('BB_INVALID_REQUEST', 'A sale can have up to 500 items.');
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) i
    where jsonb_typeof(i -> 'barcode') <> 'string' or length(trim(i ->> 'barcode')) = 0
       or jsonb_typeof(i -> 'quantity') <> 'number'
       or (i ->> 'quantity')::numeric <> trunc((i ->> 'quantity')::numeric)
       or (i ->> 'quantity')::numeric < 1 or (i ->> 'quantity')::numeric > 100000
  ) then
    perform app.raise('BB_INVALID_REQUEST', 'Each item needs a barcode and a whole-number quantity of at least 1.');
  end if;

  select array_agg(distinct trim(i ->> 'barcode')) into v_unknown
  from jsonb_array_elements(p_items) i
  where not exists (select 1 from public.products p where p.tenant_id = p_tenant_id and p.barcode = trim(i ->> 'barcode'));
  if v_unknown is not null then
    perform app.raise('BB_UNKNOWN_BARCODE', 'Unknown barcode(s): ' || array_to_string(v_unknown, ', '));
  end if;

  insert into public.sales (tenant_id, location_id, external_ref, source, created_by)
  values (p_tenant_id, p_location_id, v_ref, p_source, p_user_id)
  returning id into v_sale_id;

  -- Same barcode listed twice is summed. Lock order by product id avoids deadlocks between concurrent sales.
  for v_item in
    select p.id as product_id, p.barcode, sum((i ->> 'quantity')::integer)::integer as quantity
    from jsonb_array_elements(p_items) i
    join public.products p on p.tenant_id = p_tenant_id and p.barcode = trim(i ->> 'barcode')
    group by p.id, p.barcode
    order by p.id
  loop
    insert into public.sale_lines (tenant_id, sale_id, product_id, barcode, quantity)
    values (p_tenant_id, v_sale_id, v_item.product_id, v_item.barcode, v_item.quantity);
    v_after := app.apply_stock_movement(p_tenant_id, v_item.product_id, p_location_id, 'SALE', -v_item.quantity,
      'sale', v_sale_id, 'Sale ' || v_ref);
    v_lines := v_lines || jsonb_build_object('barcode', v_item.barcode, 'quantity', v_item.quantity, 'remaining', v_after);
  end loop;

  insert into public.audit_log (tenant_id, user_id, action, entity_type, entity_id, details)
  values (p_tenant_id, p_user_id, 'sale.recorded', 'sale', v_sale_id,
          jsonb_build_object('external_ref', v_ref, 'source', p_source, 'lines', jsonb_array_length(v_lines)));

  return jsonb_build_object('sale_id', v_sale_id, 'external_ref', v_ref, 'duplicate', false,
    'location_id', p_location_id, 'lines', v_lines);
end;
$$;

-- For the in-system billing module (signed-in users). Store staff may only sell from their own store.
create function public.record_sale(p_location_id uuid, p_external_ref text, p_items jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_profile public.profiles := app.require_user(array['OWNER', 'STORE_STAFF']::public.app_role[]);
begin
  perform app.assert_location_access(v_profile, p_location_id);
  return app.record_sale_for_tenant(v_profile.tenant_id, p_location_id, p_external_ref, p_items, 'BILLING', v_profile.user_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- API keys: "bb_live_<8 hex prefix>_<secret>". Only sha256(full key) is stored; the key is shown once.
-- ---------------------------------------------------------------------------
create function app.new_api_key(p_tenant_id uuid, p_name text, p_user_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_prefix text := encode(extensions.gen_random_bytes(4), 'hex');
  v_secret text := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', 'xyz');
  v_key text := 'bb_live_' || v_prefix || '_' || v_secret;
  v_id uuid;
begin
  insert into public.api_keys (tenant_id, name, prefix, key_hash, created_by)
  values (p_tenant_id, trim(p_name), v_prefix, encode(extensions.digest(v_key, 'sha256'), 'hex'), p_user_id)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'key', v_key, 'prefix', v_prefix);
end;
$$;

create function public.create_api_key(p_name text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_owner public.profiles := app.require_user(array['OWNER']::public.app_role[]);
  v_result jsonb;
begin
  if nullif(trim(p_name), '') is null then
    perform app.raise('BB_NAME_REQUIRED', 'Name the key, e.g. "Billing counter".');
  end if;
  if (select count(*) from public.api_keys where tenant_id = v_owner.tenant_id and revoked_at is null) >= 5 then
    perform app.raise('BB_TOO_MANY_KEYS', 'You can have up to 5 active keys. Revoke one first.');
  end if;
  v_result := app.new_api_key(v_owner.tenant_id, p_name, v_owner.user_id);
  perform app.audit(v_owner.tenant_id, 'api_key.created', 'api_key', (v_result ->> 'id')::uuid,
    jsonb_build_object('prefix', v_result ->> 'prefix', 'name', trim(p_name)));
  return v_result;
end;
$$;

-- Rotate: issue a replacement with the same name and revoke the old key in one step.
create function public.rotate_api_key(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_owner public.profiles := app.require_user(array['OWNER']::public.app_role[]);
  v_old public.api_keys;
  v_result jsonb;
begin
  select * into v_old from public.api_keys where id = p_id and tenant_id = v_owner.tenant_id and revoked_at is null for update;
  if v_old.id is null then
    perform app.raise('BB_NOT_FOUND', 'That key was not found or is already revoked.');
  end if;
  update public.api_keys set revoked_at = now() where id = p_id;
  v_result := app.new_api_key(v_owner.tenant_id, v_old.name, v_owner.user_id);
  perform app.audit(v_owner.tenant_id, 'api_key.rotated', 'api_key', p_id,
    jsonb_build_object('old_prefix', v_old.prefix, 'new_prefix', v_result ->> 'prefix'));
  return v_result;
end;
$$;

create function public.revoke_api_key(p_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_owner public.profiles := app.require_user(array['OWNER']::public.app_role[]);
begin
  update public.api_keys set revoked_at = now() where id = p_id and tenant_id = v_owner.tenant_id and revoked_at is null;
  if not found then
    perform app.raise('BB_NOT_FOUND', 'That key was not found or is already revoked.');
  end if;
  perform app.audit(v_owner.tenant_id, 'api_key.revoked', 'api_key', p_id, '{}'::jsonb);
end;
$$;

-- Called only by the `sales` Edge Function (service role): verifies the API key and records the sale in one
-- transaction. Raises BB_INVALID_API_KEY for unknown/revoked keys.
create function public.api_record_sale(p_api_key text, p_location_id uuid, p_external_ref text, p_items jsonb)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_key public.api_keys;
  v_prefix text := substring(coalesce(p_api_key, '') from '^bb_live_([0-9a-f]{8})_');
begin
  select * into v_key from public.api_keys where prefix = v_prefix and revoked_at is null;
  if v_key.id is null or v_key.key_hash <> encode(extensions.digest(p_api_key, 'sha256'), 'hex') then
    perform app.raise('BB_INVALID_API_KEY', 'The API key is missing, invalid, or revoked.');
  end if;
  update public.api_keys set last_used_at = now() where id = v_key.id;
  return app.record_sale_for_tenant(v_key.tenant_id, p_location_id, p_external_ref, p_items, 'API', null);
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema app from public, anon, authenticated;
grant execute on function app.current_tenant_id(), app.current_app_role(), app.is_manager(), app.is_owner(),
  app.visible_location_ids() to authenticated;

revoke execute on function public.create_return_damage_entry(uuid, public.return_damage_type, uuid, integer, text, uuid) from public, anon;
grant execute on function public.create_return_damage_entry(uuid, public.return_damage_type, uuid, integer, text, uuid) to authenticated;
revoke execute on function public.decide_return_damage(uuid, boolean, text, uuid) from public, anon;
grant execute on function public.decide_return_damage(uuid, boolean, text, uuid) to authenticated;
revoke execute on function public.record_sale(uuid, text, jsonb) from public, anon;
grant execute on function public.record_sale(uuid, text, jsonb) to authenticated;
revoke execute on function public.create_api_key(text) from public, anon;
grant execute on function public.create_api_key(text) to authenticated;
revoke execute on function public.rotate_api_key(uuid) from public, anon;
grant execute on function public.rotate_api_key(uuid) to authenticated;
revoke execute on function public.revoke_api_key(uuid) from public, anon;
grant execute on function public.revoke_api_key(uuid) to authenticated;
revoke execute on function public.api_record_sale(text, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.api_record_sale(text, uuid, text, jsonb) to service_role;
