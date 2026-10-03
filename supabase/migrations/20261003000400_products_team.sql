-- Phase 2: catalogue (products, suppliers, costs), product search, import, images, and team management.

-- ---------------------------------------------------------------------------
-- Row-level audit for tables that clients may write directly (catalogue, team, company details).
-- Stock and document changes are audited inside their RPCs instead.
-- ---------------------------------------------------------------------------
create function app.audit_row()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_changes jsonb;
begin
  if tg_op = 'UPDATE' then
    select coalesce(jsonb_object_agg(key, jsonb_build_object('from', v_old -> key, 'to', value)), '{}'::jsonb)
    into v_changes
    from jsonb_each(v_new)
    where v_old -> key is distinct from value and key not in ('updated_at');
    if v_changes = '{}'::jsonb then
      return new;
    end if;
  end if;

  insert into public.audit_log (tenant_id, user_id, action, entity_type, entity_id, details)
  values (
    coalesce((v_row ->> 'tenant_id')::uuid, (v_row ->> 'id')::uuid),
    auth.uid(),
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    coalesce((v_row ->> 'id')::uuid, (v_row ->> 'product_id')::uuid, (v_row ->> 'user_id')::uuid),
    case tg_op when 'UPDATE' then v_changes else v_row end
  );
  return coalesce(new, old);
end;
$$;

create trigger audit_products after insert or update or delete on public.products
  for each row execute function app.audit_row();
create trigger audit_product_costs after insert or update or delete on public.product_costs
  for each row execute function app.audit_row();
create trigger audit_suppliers after insert or update or delete on public.suppliers
  for each row execute function app.audit_row();
create trigger audit_tenants after update on public.tenants
  for each row execute function app.audit_row();
create trigger audit_locations after insert or update on public.locations
  for each row execute function app.audit_row();
create trigger audit_profiles after insert or update on public.profiles
  for each row execute function app.audit_row();

-- ---------------------------------------------------------------------------
-- Products: normalise input and generate SKU / barcode when left blank.
-- ---------------------------------------------------------------------------
create function app.products_before_write()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.name := trim(new.name);
  new.sku := nullif(upper(trim(coalesce(new.sku, ''))), '');
  new.barcode := nullif(trim(coalesce(new.barcode, '')), '');

  if new.sku is null then
    loop
      new.sku := case new.category when 'CLOTHING' then 'CLO-' else 'ACC-' end
        || lpad(app.next_counter(new.tenant_id, 'sku:' || new.category)::text, 5, '0');
      exit when not exists (
        select 1 from public.products where tenant_id = new.tenant_id and sku = new.sku and id <> new.id);
    end loop;
  end if;

  if new.barcode is null then
    loop
      new.barcode := 'BB' || lpad(app.next_counter(new.tenant_id, 'barcode')::text, 10, '0');
      exit when not exists (
        select 1 from public.products where tenant_id = new.tenant_id and barcode = new.barcode and id <> new.id);
    end loop;
  end if;

  if tg_op = 'UPDATE' then
    new.tenant_id := old.tenant_id; -- products never move between tenants
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger products_before_write before insert or update on public.products
  for each row execute function app.products_before_write();

create function app.product_costs_before_write()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger product_costs_before_write before insert or update on public.product_costs
  for each row execute function app.product_costs_before_write();

-- Plan limits are enforced here from Phase 10; until then this is a no-op hook.
create function app.assert_within_limit(p_tenant_id uuid, p_kind text)
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  return;
end;
$$;

-- Create or update a product and its cost price atomically.
-- p_cost_price: null clears the cost. Blank SKU/barcode are generated.
create function public.save_product(
  p_id uuid,
  p_name text,
  p_category public.product_category,
  p_sku text,
  p_barcode text,
  p_selling_price numeric,
  p_supplier_id uuid,
  p_reorder_level integer,
  p_active boolean,
  p_cost_price numeric
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_profile public.profiles := app.require_user(array['OWNER', 'STOREROOM_MANAGER']::public.app_role[]);
  v_id uuid := p_id;
begin
  if p_supplier_id is not null
     and not exists (select 1 from public.suppliers where id = p_supplier_id and tenant_id = v_profile.tenant_id) then
    perform app.raise('BB_NOT_FOUND', 'That supplier was not found.');
  end if;

  if v_id is null then
    perform app.assert_within_limit(v_profile.tenant_id, 'products');
    insert into public.products
      (tenant_id, name, category, sku, barcode, selling_price, supplier_id, reorder_level, active)
    values
      (v_profile.tenant_id, p_name, p_category, p_sku, p_barcode, coalesce(p_selling_price, 0), p_supplier_id,
       coalesce(p_reorder_level, 0), coalesce(p_active, true))
    returning id into v_id;
  else
    update public.products
    set name = p_name, category = p_category, sku = p_sku, barcode = p_barcode,
        selling_price = coalesce(p_selling_price, 0), supplier_id = p_supplier_id,
        reorder_level = coalesce(p_reorder_level, 0), active = coalesce(p_active, true)
    where id = v_id and tenant_id = v_profile.tenant_id;
    if not found then
      perform app.raise('BB_NOT_FOUND', 'That product was not found.');
    end if;
  end if;

  if p_cost_price is null then
    delete from public.product_costs where product_id = v_id;
  else
    insert into public.product_costs (product_id, tenant_id, cost_price)
    values (v_id, v_profile.tenant_id, p_cost_price)
    on conflict (product_id) do update set cost_price = excluded.cost_price
    where public.product_costs.cost_price is distinct from excluded.cost_price;
  end if;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Product + stock search for one location. SECURITY INVOKER: RLS decides what the caller can see.
-- Server-side pagination: returns one page plus the total match count.
-- ---------------------------------------------------------------------------
create function public.search_stock(
  p_location_id uuid,
  p_q text default null,
  p_category public.product_category default null,
  p_supplier_id uuid default null,
  p_stock text default null,          -- null | 'low' | 'out'
  p_include_inactive boolean default false,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid, name text, category public.product_category, sku text, barcode text, selling_price numeric,
  reorder_level integer, image_path text, active boolean, supplier_id uuid, quantity integer, total_count bigint
)
language sql stable security invoker set search_path = ''
as $$
  with q as (
    select nullif(trim(p_q), '') as raw,
           '%' || replace(replace(replace(nullif(trim(p_q), ''), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pattern
  )
  select p.id, p.name, p.category, p.sku, p.barcode, p.selling_price, p.reorder_level, p.image_path, p.active,
         p.supplier_id, coalesce(sl.quantity, 0) as quantity, count(*) over () as total_count
  from public.products p
  cross join q
  left join public.stock_levels sl on sl.product_id = p.id and sl.location_id = p_location_id
  where p.tenant_id = (select app.current_tenant_id())
    and p_location_id = any ((select app.visible_location_ids())::uuid[])
    and (p_include_inactive or p.active)
    and (q.raw is null or p.name ilike q.pattern or p.sku ilike q.pattern or p.barcode = q.raw)
    and (p_category is null or p.category = p_category)
    and (p_supplier_id is null or p.supplier_id = p_supplier_id)
    and (p_stock is null
         or (p_stock = 'low' and p.reorder_level > 0 and coalesce(sl.quantity, 0) <= p.reorder_level)
         or (p_stock = 'out' and coalesce(sl.quantity, 0) = 0))
  order by (p.barcode = q.raw or upper(p.sku) = upper(q.raw)) desc nulls last, p.name, p.id
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0)
$$;

-- Exact lookup used by scanners (barcode first, then SKU). Returns the product with stock at one location.
create function public.find_product_by_code(p_code text, p_location_id uuid default null)
returns table (id uuid, name text, sku text, barcode text, selling_price numeric, image_path text, active boolean,
               quantity integer)
language sql stable security invoker set search_path = ''
as $$
  select p.id, p.name, p.sku, p.barcode, p.selling_price, p.image_path, p.active, coalesce(sl.quantity, 0)
  from public.products p
  left join public.stock_levels sl on sl.product_id = p.id and sl.location_id = p_location_id
  where p.tenant_id = (select app.current_tenant_id())
    and (p.barcode = trim(p_code) or upper(p.sku) = upper(trim(p_code)))
  order by (p.barcode = trim(p_code)) desc
  limit 1
$$;

-- ---------------------------------------------------------------------------
-- Import: validates every row, then (unless dry run) inserts new products / updates existing ones by SKU,
-- all in one transaction. Suppliers are matched by name and created if missing.
-- Each row: {name, category, sku?, barcode?, selling_price?, cost_price?, reorder_level?, supplier?}
-- ---------------------------------------------------------------------------
create function public.import_products(p_rows jsonb, p_dry_run boolean default true)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_profile public.profiles := app.require_user(array['OWNER', 'STOREROOM_MANAGER']::public.app_role[]);
  v_tenant uuid := v_profile.tenant_id;
  v_row jsonb;
  v_i integer := 0;
  v_errors text[];
  v_results jsonb := '[]'::jsonb;
  v_has_errors boolean := false;
  v_name text; v_category text; v_sku text; v_barcode text; v_price numeric; v_cost numeric; v_reorder integer;
  v_supplier text; v_supplier_id uuid; v_existing uuid; v_action text;
  v_created integer := 0; v_updated integer := 0;
  v_seen_skus text[] := '{}'::text[]; v_seen_barcodes text[] := '{}'::text[];
begin
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    perform app.raise('BB_INVALID_IMPORT', 'The file has no rows to import.');
  end if;
  if jsonb_array_length(p_rows) > 5000 then
    perform app.raise('BB_INVALID_IMPORT', 'Import up to 5,000 rows at a time.');
  end if;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_i := v_i + 1;
    v_errors := '{}'::text[];
    v_name := nullif(trim(v_row ->> 'name'), '');
    v_category := upper(nullif(trim(v_row ->> 'category'), ''));
    v_sku := nullif(upper(trim(v_row ->> 'sku')), '');
    v_barcode := nullif(trim(v_row ->> 'barcode'), '');
    v_supplier := nullif(trim(v_row ->> 'supplier'), '');
    v_existing := null;
    v_supplier_id := null;

    if v_name is null then v_errors := array_append(v_errors, 'Name is required'); end if;
    if length(v_name) > 160 then v_errors := array_append(v_errors, 'Name is longer than 160 characters'); end if;
    if v_category is null or v_category not in ('CLOTHING', 'ACCESSORY') then
      v_errors := array_append(v_errors, 'Category must be Clothing or Accessory');
    end if;
    if v_sku is not null and v_sku !~ '^[A-Za-z0-9._/-]{1,40}$' then
      v_errors := array_append(v_errors, 'SKU may use letters, numbers, . _ / - (max 40)');
    end if;
    if v_barcode is not null and v_barcode !~ '^[!-~]{1,32}$' then
      v_errors := array_append(v_errors, 'Barcode must be 1–32 printable characters without spaces');
    end if;

    begin
      v_price := coalesce(nullif(trim(v_row ->> 'selling_price'), '')::numeric, 0);
      if v_price < 0 then v_errors := array_append(v_errors, 'Selling price cannot be negative'); end if;
    exception when others then v_errors := array_append(v_errors, 'Selling price is not a number'); v_price := 0;
    end;
    begin
      v_cost := nullif(trim(v_row ->> 'cost_price'), '')::numeric;
      if v_cost < 0 then v_errors := array_append(v_errors, 'Cost price cannot be negative'); end if;
    exception when others then v_errors := array_append(v_errors, 'Cost price is not a number'); v_cost := null;
    end;
    begin
      v_reorder := coalesce(nullif(trim(v_row ->> 'reorder_level'), '')::integer, 0);
      if v_reorder < 0 then v_errors := array_append(v_errors, 'Reorder level cannot be negative'); end if;
    exception when others then v_errors := array_append(v_errors, 'Reorder level must be a whole number'); v_reorder := 0;
    end;

    if v_sku is not null then
      if v_sku = any (v_seen_skus) then v_errors := array_append(v_errors, 'SKU appears more than once in the file'); end if;
      v_seen_skus := v_seen_skus || v_sku;
      select id into v_existing from public.products where tenant_id = v_tenant and sku = v_sku;
    end if;
    if v_barcode is not null then
      if v_barcode = any (v_seen_barcodes) then v_errors := array_append(v_errors, 'Barcode appears more than once in the file'); end if;
      v_seen_barcodes := v_seen_barcodes || v_barcode;
      if exists (select 1 from public.products where tenant_id = v_tenant and barcode = v_barcode
                 and id is distinct from v_existing) then
        v_errors := array_append(v_errors, 'Barcode is already used by another product');
      end if;
    end if;

    v_action := case when v_existing is null then 'create' else 'update' end;
    if cardinality(v_errors) > 0 then
      v_has_errors := true;
    end if;
    v_results := v_results || jsonb_build_object('row', v_i, 'action', v_action, 'errors', to_jsonb(v_errors));

    if not p_dry_run and cardinality(v_errors) = 0 then
      if v_supplier is not null then
        select id into v_supplier_id from public.suppliers where tenant_id = v_tenant and lower(name) = lower(v_supplier);
        if v_supplier_id is null then
          insert into public.suppliers (tenant_id, name) values (v_tenant, v_supplier) returning id into v_supplier_id;
        end if;
      end if;
      if v_existing is null then
        perform app.assert_within_limit(v_tenant, 'products');
        insert into public.products (tenant_id, name, category, sku, barcode, selling_price, supplier_id, reorder_level)
        values (v_tenant, v_name, v_category::public.product_category, v_sku, v_barcode, v_price, v_supplier_id, v_reorder)
        returning id into v_existing;
        v_created := v_created + 1;
      else
        update public.products
        set name = v_name, category = v_category::public.product_category,
            barcode = coalesce(v_barcode, barcode), selling_price = v_price,
            supplier_id = coalesce(v_supplier_id, supplier_id), reorder_level = v_reorder
        where id = v_existing;
        v_updated := v_updated + 1;
      end if;
      if v_cost is not null then
        insert into public.product_costs (product_id, tenant_id, cost_price) values (v_existing, v_tenant, v_cost)
        on conflict (product_id) do update set cost_price = excluded.cost_price;
      end if;
    end if;
  end loop;

  if not p_dry_run and v_has_errors then
    perform app.raise('BB_INVALID_IMPORT', 'Some rows have errors. Fix them and try again — nothing was imported.');
  end if;
  if not p_dry_run then
    perform app.audit(v_tenant, 'products.imported', 'product', null,
      jsonb_build_object('created', v_created, 'updated', v_updated));
  end if;

  return jsonb_build_object('rows', v_results, 'has_errors', v_has_errors, 'created', v_created, 'updated', v_updated);
end;
$$;

-- ---------------------------------------------------------------------------
-- Team and locations (Owner only).
-- ---------------------------------------------------------------------------

-- Links an invited auth user to the owner's tenant. Called by the server with the service-role key right after
-- auth.admin.inviteUserByEmail(); the owner's identity is passed in and re-verified here.
create function public.admin_add_member(
  p_owner_id uuid,
  p_user_id uuid,
  p_full_name text,
  p_email text,
  p_role public.app_role,
  p_location_ids uuid[]
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_tenant uuid;
begin
  select tenant_id into v_tenant from public.profiles where user_id = p_owner_id and role = 'OWNER' and active;
  if v_tenant is null then
    perform app.raise('BB_FORBIDDEN', 'Only the owner can invite people.');
  end if;
  perform app.assert_tenant_writable(v_tenant);
  perform app.assert_within_limit(v_tenant, 'users');
  if exists (select 1 from public.profiles where user_id = p_user_id) then
    perform app.raise('BB_ALREADY_MEMBER', 'This person already has an account with a shop.');
  end if;
  if p_role = 'OWNER' then
    perform app.raise('BB_FORBIDDEN', 'A shop has one owner.');
  end if;
  if p_role = 'STORE_STAFF' and coalesce(cardinality(p_location_ids), 0) = 0 then
    perform app.raise('BB_LOCATION_REQUIRED', 'Choose the store this person works in.');
  end if;
  if exists (select 1 from unnest(p_location_ids) l
             where not exists (select 1 from public.locations where id = l and tenant_id = v_tenant
                               and kind = case p_role when 'STORE_STAFF' then 'STORE'::public.location_kind
                                                      else 'STORE_ROOM'::public.location_kind end)) then
    perform app.raise('BB_LOCATION_NOT_FOUND', 'Choose a valid location for this role.');
  end if;

  insert into public.profiles (user_id, tenant_id, role, full_name, email)
  values (p_user_id, v_tenant, p_role, trim(p_full_name), lower(trim(p_email)));
  insert into public.profile_locations (user_id, location_id, tenant_id)
  select p_user_id, l, v_tenant from unnest(coalesce(p_location_ids, '{}')) l;

  insert into public.audit_log (tenant_id, user_id, action, entity_type, entity_id, details)
  values (v_tenant, p_owner_id, 'team.invited', 'profile', p_user_id,
          jsonb_build_object('email', p_email, 'role', p_role));
end;
$$;

create function public.update_member(
  p_user_id uuid,
  p_full_name text,
  p_role public.app_role,
  p_location_ids uuid[],
  p_active boolean
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_owner public.profiles := app.require_user(array['OWNER']::public.app_role[]);
  v_target public.profiles;
begin
  select * into v_target from public.profiles where user_id = p_user_id and tenant_id = v_owner.tenant_id;
  if v_target.user_id is null then
    perform app.raise('BB_NOT_FOUND', 'That person was not found.');
  end if;
  if v_target.role = 'OWNER' or p_role = 'OWNER' then
    perform app.raise('BB_FORBIDDEN', 'The owner''s role can''t be changed here.');
  end if;
  if p_role = 'STORE_STAFF' and coalesce(cardinality(p_location_ids), 0) = 0 then
    perform app.raise('BB_LOCATION_REQUIRED', 'Choose the store this person works in.');
  end if;
  if exists (select 1 from unnest(p_location_ids) l
             where not exists (select 1 from public.locations where id = l and tenant_id = v_owner.tenant_id
                               and kind = case p_role when 'STORE_STAFF' then 'STORE'::public.location_kind
                                                      else 'STORE_ROOM'::public.location_kind end)) then
    perform app.raise('BB_LOCATION_NOT_FOUND', 'Choose a valid location for this role.');
  end if;

  update public.profiles set full_name = trim(p_full_name), role = p_role, active = p_active
  where user_id = p_user_id;
  delete from public.profile_locations where user_id = p_user_id;
  insert into public.profile_locations (user_id, location_id, tenant_id)
  select p_user_id, l, v_owner.tenant_id from unnest(coalesce(p_location_ids, '{}')) l;
end;
$$;

create function public.save_location(p_id uuid, p_name text, p_address text, p_active boolean default true)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_owner public.profiles := app.require_user(array['OWNER']::public.app_role[]);
  v_id uuid := p_id;
  v_kind public.location_kind;
begin
  if v_id is null then
    perform app.assert_within_limit(v_owner.tenant_id, 'locations');
    insert into public.locations (tenant_id, kind, name, address)
    values (v_owner.tenant_id, 'STORE', trim(p_name), nullif(trim(p_address), ''))
    returning id into v_id;
  else
    select kind into v_kind from public.locations where id = v_id and tenant_id = v_owner.tenant_id;
    if v_kind is null then
      perform app.raise('BB_NOT_FOUND', 'That location was not found.');
    end if;
    if v_kind = 'STORE_ROOM' and not p_active then
      perform app.raise('BB_FORBIDDEN', 'The Store Room can''t be deactivated.');
    end if;
    if not p_active and exists (select 1 from public.stock_levels where location_id = v_id and quantity > 0) then
      perform app.raise('BB_LOCATION_HAS_STOCK', 'Return this store''s stock to the Store Room before deactivating it.');
    end if;
    update public.locations set name = trim(p_name), address = nullif(trim(p_address), ''), active = p_active
    where id = v_id;
  end if;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Product images: private bucket, one folder per tenant.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', false, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy product_images_select on storage.objects for select to authenticated
  using (bucket_id = 'product-images' and (storage.foldername(name))[1] = (select app.current_tenant_id())::text);
create policy product_images_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images'
              and (storage.foldername(name))[1] = (select app.current_tenant_id())::text
              and (select app.is_manager()));
create policy product_images_update on storage.objects for update to authenticated
  using (bucket_id = 'product-images'
         and (storage.foldername(name))[1] = (select app.current_tenant_id())::text
         and (select app.is_manager()));
create policy product_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'product-images'
         and (storage.foldername(name))[1] = (select app.current_tenant_id())::text
         and (select app.is_manager()));

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema app from public, anon, authenticated;
grant execute on function app.current_tenant_id(), app.current_app_role(), app.is_manager(), app.is_owner(),
  app.visible_location_ids() to authenticated;

revoke execute on function public.save_product(uuid, text, public.product_category, text, text, numeric, uuid, integer, boolean, numeric) from public, anon;
grant execute on function public.save_product(uuid, text, public.product_category, text, text, numeric, uuid, integer, boolean, numeric) to authenticated;
revoke execute on function public.search_stock(uuid, text, public.product_category, uuid, text, boolean, integer, integer) from public, anon;
grant execute on function public.search_stock(uuid, text, public.product_category, uuid, text, boolean, integer, integer) to authenticated;
revoke execute on function public.find_product_by_code(text, uuid) from public, anon;
grant execute on function public.find_product_by_code(text, uuid) to authenticated;
revoke execute on function public.import_products(jsonb, boolean) from public, anon;
grant execute on function public.import_products(jsonb, boolean) to authenticated;
revoke execute on function public.update_member(uuid, text, public.app_role, uuid[], boolean) from public, anon;
grant execute on function public.update_member(uuid, text, public.app_role, uuid[], boolean) to authenticated;
revoke execute on function public.save_location(uuid, text, text, boolean) from public, anon;
grant execute on function public.save_location(uuid, text, text, boolean) to authenticated;
-- Server-only (service role): invites need Supabase Auth admin rights.
revoke execute on function public.admin_add_member(uuid, uuid, text, text, public.app_role, uuid[]) from public, anon, authenticated;
grant execute on function public.admin_add_member(uuid, uuid, text, text, public.app_role, uuid[]) to service_role;
