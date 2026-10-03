-- BoonBaby Store Manager â€” security: helper functions, grants, and Row Level Security.
--
-- Rules live in a handful of SECURITY DEFINER helpers in the private `app` schema so policies stay short
-- and consistent. Policies call them as `(select app.fn())` so Postgres evaluates them once per query.

-- ---------------------------------------------------------------------------
-- Default privileges: nothing is granted implicitly. Every grant below is deliberate.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;
-- Postgres grants EXECUTE to PUBLIC on every new function; only a global (not per-schema) default can remove it.
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema app revoke execute on functions from public;

grant usage on schema app to authenticated;

-- ---------------------------------------------------------------------------
-- Identity helpers (used by RLS policies)
-- ---------------------------------------------------------------------------
create function app.current_tenant_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select p.tenant_id from public.profiles p where p.user_id = auth.uid() and p.active
$$;

create function app.current_app_role()
returns public.app_role
language sql stable security definer set search_path = ''
as $$
  select p.role from public.profiles p where p.user_id = auth.uid() and p.active
$$;

-- OWNER and STOREROOM_MANAGER work across the whole tenant.
create function app.is_manager()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select p.role in ('OWNER', 'STOREROOM_MANAGER') from public.profiles p where p.user_id = auth.uid() and p.active),
    false)
$$;

create function app.is_owner()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select p.role = 'OWNER' from public.profiles p where p.user_id = auth.uid() and p.active),
    false)
$$;

-- Locations whose stock and documents the current user may see.
-- Managers: every location in the tenant. Store staff: only the store(s) assigned to them.
create function app.visible_location_ids()
returns uuid[]
language sql stable security definer set search_path = ''
as $$
  select case
    when p.role in ('OWNER', 'STOREROOM_MANAGER') then
      array(select l.id from public.locations l where l.tenant_id = p.tenant_id)
    else
      array(select pl.location_id from public.profile_locations pl where pl.user_id = p.user_id)
  end
  from public.profiles p
  where p.user_id = auth.uid() and p.active
$$;

revoke execute on all functions in schema app from public;
grant execute on function app.current_tenant_id(), app.current_app_role(), app.is_manager(), app.is_owner(),
  app.visible_location_ids() to authenticated;

-- ---------------------------------------------------------------------------
-- Errors, audit, counters, idempotency (internal; only called from SECURITY DEFINER functions)
-- ---------------------------------------------------------------------------

-- All business errors use SQLSTATE P0001 with a stable code in HINT. The UI maps the code to plain language
-- (src/lib/errors.ts) and falls back to the message, which is already written for humans.
-- STABLE (it only raises, never writes) so the STABLE guard functions below may call it.
create function app.raise(p_code text, p_message text)
returns void
language plpgsql stable
as $$
begin
  raise exception using errcode = 'P0001', message = p_message, hint = p_code;
end;
$$;

create function app.audit(
  p_tenant_id uuid, p_action text, p_entity_type text, p_entity_id uuid, p_details jsonb default '{}'::jsonb
)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.audit_log (tenant_id, user_id, action, entity_type, entity_id, details)
  values (p_tenant_id, auth.uid(), p_action, p_entity_type, p_entity_id, coalesce(p_details, '{}'::jsonb))
$$;

-- Gap-free per-tenant numbering for documents, barcodes, and SKUs. Row lock serialises concurrent callers.
create function app.next_counter(p_tenant_id uuid, p_name text)
returns bigint
language sql security definer set search_path = ''
as $$
  insert into public.tenant_counters as c (tenant_id, name, value)
  values (p_tenant_id, p_name, 1)
  on conflict (tenant_id, name) do update set value = c.value + 1
  returning value
$$;

create function app.next_document_number(p_tenant_id uuid, p_prefix text)
returns text
language sql security definer set search_path = ''
as $$
  select p_prefix || '-' || lpad(app.next_counter(p_tenant_id, 'doc:' || p_prefix)::text, 5, '0')
$$;

-- Blocks writes for tenants that are read-only (unpaid, canceled, or trial ended).
create function app.assert_tenant_writable(p_tenant_id uuid)
returns void
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_tenant public.tenants;
begin
  select * into v_tenant from public.tenants where id = p_tenant_id;
  if v_tenant.status = 'canceled' then
    perform app.raise('BB_TENANT_CANCELED', 'This account has been canceled. Data is read-only.');
  elsif v_tenant.status = 'past_due' then
    perform app.raise('BB_TENANT_PAST_DUE', 'Your subscription payment is overdue. The account is read-only until it is paid.');
  elsif v_tenant.status = 'trial' and v_tenant.trial_ends_at < now() then
    perform app.raise('BB_TRIAL_ENDED', 'Your free trial has ended. Choose a plan to keep making changes.');
  end if;
end;
$$;

-- Entry guard for every mutating RPC: signed in, active, one of the allowed roles, tenant writable.
create function app.require_user(p_roles public.app_role[])
returns public.profiles
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  if auth.uid() is null then
    perform app.raise('BB_NOT_SIGNED_IN', 'Please sign in again.');
  end if;
  select * into v_profile from public.profiles where user_id = auth.uid() and active;
  if v_profile.user_id is null then
    perform app.raise('BB_NO_PROFILE', 'Your account is not linked to a shop, or it has been deactivated.');
  end if;
  if not (v_profile.role = any (p_roles)) then
    perform app.raise('BB_FORBIDDEN', 'You do not have permission to do this.');
  end if;
  perform app.assert_tenant_writable(v_profile.tenant_id);
  return v_profile;
end;
$$;

-- Store staff may only act on locations assigned to them; managers on any location in their tenant.
create function app.assert_location_access(p_profile public.profiles, p_location_id uuid)
returns public.locations
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_location public.locations;
begin
  select * into v_location from public.locations where id = p_location_id and tenant_id = p_profile.tenant_id;
  if v_location.id is null then
    perform app.raise('BB_LOCATION_NOT_FOUND', 'That location was not found.');
  end if;
  if p_profile.role = 'STORE_STAFF' and not exists (
    select 1 from public.profile_locations pl where pl.user_id = p_profile.user_id and pl.location_id = p_location_id
  ) then
    perform app.raise('BB_FORBIDDEN', 'You can only work with your own store.');
  end if;
  return v_location;
end;
$$;

create function app.store_room_id(p_tenant_id uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select id from public.locations where tenant_id = p_tenant_id and kind = 'STORE_ROOM'
$$;

-- Idempotency: call begin() first. It serialises callers that share a key and returns the stored result
-- of an earlier successful call (or null). Call finish() with the result just before returning.
create function app.idempotency_begin(p_tenant_id uuid, p_key uuid, p_fn text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.idempotency_keys;
begin
  if p_key is null then
    return null;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || ':' || p_key::text, 0));
  select * into v_row from public.idempotency_keys where tenant_id = p_tenant_id and key = p_key;
  if v_row.key is null then
    return null;
  end if;
  if v_row.fn <> p_fn then
    perform app.raise('BB_IDEMPOTENCY_MISMATCH', 'This request key was already used for a different action.');
  end if;
  return v_row.result;
end;
$$;

create function app.idempotency_finish(p_tenant_id uuid, p_key uuid, p_fn text, p_result jsonb)
returns jsonb
language sql security definer set search_path = ''
as $$
  insert into public.idempotency_keys (tenant_id, key, fn, result)
  select p_tenant_id, p_key, p_fn, p_result where p_key is not null;
  select p_result;
$$;

-- ---------------------------------------------------------------------------
-- The ONLY way stock changes. Locks the level row, refuses to go negative, writes the ledger row.
-- ---------------------------------------------------------------------------
create function app.apply_stock_movement(
  p_tenant_id uuid,
  p_product_id uuid,
  p_location_id uuid,
  p_type public.movement_type,
  p_delta integer,
  p_ref_type text,
  p_ref_id uuid,
  p_note text default null
)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_qty integer;
  v_product_name text;
begin
  if p_delta is null or p_delta = 0 then
    perform app.raise('BB_INVALID_QUANTITY', 'Quantity must be more than zero.');
  end if;

  insert into public.stock_levels (tenant_id, location_id, product_id, quantity)
  values (p_tenant_id, p_location_id, p_product_id, 0)
  on conflict (location_id, product_id) do nothing;

  select quantity into v_qty
  from public.stock_levels
  where location_id = p_location_id and product_id = p_product_id and tenant_id = p_tenant_id
  for update;

  if v_qty is null then
    perform app.raise('BB_NOT_FOUND', 'Product or location not found.');
  end if;

  if v_qty + p_delta < 0 then
    select name into v_product_name from public.products where id = p_product_id;
    perform app.raise(
      'BB_INSUFFICIENT_STOCK',
      format('Not enough stock of "%s". Available: %s, needed: %s.', v_product_name, v_qty, -p_delta)
    );
  end if;

  update public.stock_levels
  set quantity = v_qty + p_delta, updated_at = now()
  where location_id = p_location_id and product_id = p_product_id;

  insert into public.stock_movements
    (tenant_id, product_id, location_id, type, quantity_delta, quantity_after, ref_type, ref_id, user_id, note)
  values
    (p_tenant_id, p_product_id, p_location_id, p_type, p_delta, v_qty + p_delta, p_ref_type, p_ref_id, auth.uid(), p_note);

  return v_qty + p_delta;
end;
$$;

-- Re-assert after creating the internal functions: only the RLS helpers are executable by clients.
revoke execute on all functions in schema app from public, anon, authenticated;
grant execute on function app.current_tenant_id(), app.current_app_role(), app.is_manager(), app.is_owner(),
  app.visible_location_ids() to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security â€” enabled on EVERY table, no exceptions.
-- Writes to stock and document tables are not granted at all; they happen only inside RPCs.
-- ---------------------------------------------------------------------------
alter table public.tenants enable row level security;
alter table public.locations enable row level security;
alter table public.profiles enable row level security;
alter table public.profile_locations enable row level security;
alter table public.suppliers enable row level security;
alter table public.products enable row level security;
alter table public.product_costs enable row level security;
alter table public.stock_levels enable row level security;
alter table public.stock_movements enable row level security;
alter table public.receipts enable row level security;
alter table public.receipt_lines enable row level security;
alter table public.restock_requests enable row level security;
alter table public.restock_request_lines enable row level security;
alter table public.dispatches enable row level security;
alter table public.dispatch_lines enable row level security;
alter table public.return_damage_entries enable row level security;
alter table public.label_print_log enable row level security;
alter table public.audit_log enable row level security;
alter table public.api_keys enable row level security;
alter table public.tenant_counters enable row level security;
alter table public.idempotency_keys enable row level security;

-- tenants: members read their own tenant; the owner edits company details (columns limited by grant).
grant select on public.tenants to authenticated;
grant update (name, legal_name, address, phone, email, tax_id) on public.tenants to authenticated;
create policy tenants_select on public.tenants for select to authenticated
  using (id = (select app.current_tenant_id()));
create policy tenants_update_owner on public.tenants for update to authenticated
  using (id = (select app.current_tenant_id()) and (select app.is_owner()))
  with check (id = (select app.current_tenant_id()));

-- locations: staff see their own store(s) plus the Store Room (it is where their stock comes from),
-- never the other store. Created/renamed through RPCs.
grant select on public.locations to authenticated;
create policy locations_select on public.locations for select to authenticated
  using (
    tenant_id = (select app.current_tenant_id())
    and (id = any ((select app.visible_location_ids())::uuid[]) or kind = 'STORE_ROOM')
  );

-- profiles: managers see the team; staff see only themselves. Users may edit their own name.
grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;
create policy profiles_select on public.profiles for select to authenticated
  using (
    tenant_id = (select app.current_tenant_id())
    and ((select app.is_manager()) or user_id = (select auth.uid()))
  );
create policy profiles_update_self on public.profiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and tenant_id = (select app.current_tenant_id()));

grant select on public.profile_locations to authenticated;
create policy profile_locations_select on public.profile_locations for select to authenticated
  using (
    tenant_id = (select app.current_tenant_id())
    and ((select app.is_manager()) or user_id = (select auth.uid()))
  );

-- suppliers: managers only.
grant select, insert, update on public.suppliers to authenticated;
create policy suppliers_select on public.suppliers for select to authenticated
  using (tenant_id = (select app.current_tenant_id()) and (select app.is_manager()));
create policy suppliers_insert on public.suppliers for insert to authenticated
  with check (tenant_id = (select app.current_tenant_id()) and (select app.is_manager()));
create policy suppliers_update on public.suppliers for update to authenticated
  using (tenant_id = (select app.current_tenant_id()) and (select app.is_manager()))
  with check (tenant_id = (select app.current_tenant_id()));

-- products: everyone in the tenant reads the catalogue (no cost column here); managers write.
grant select, insert, update on public.products to authenticated;
create policy products_select on public.products for select to authenticated
  using (tenant_id = (select app.current_tenant_id()));
create policy products_insert on public.products for insert to authenticated
  with check (tenant_id = (select app.current_tenant_id()) and (select app.is_manager()));
create policy products_update on public.products for update to authenticated
  using (tenant_id = (select app.current_tenant_id()) and (select app.is_manager()))
  with check (tenant_id = (select app.current_tenant_id()));

-- product_costs: managers only. Store staff get zero rows from any query.
grant select, insert, update on public.product_costs to authenticated;
create policy product_costs_select on public.product_costs for select to authenticated
  using (tenant_id = (select app.current_tenant_id()) and (select app.is_manager()));
create policy product_costs_insert on public.product_costs for insert to authenticated
  with check (tenant_id = (select app.current_tenant_id()) and (select app.is_manager()));
create policy product_costs_update on public.product_costs for update to authenticated
  using (tenant_id = (select app.current_tenant_id()) and (select app.is_manager()))
  with check (tenant_id = (select app.current_tenant_id()));

-- stock: read-only for clients, scoped to visible locations.
grant select on public.stock_levels to authenticated;
create policy stock_levels_select on public.stock_levels for select to authenticated
  using (
    tenant_id = (select app.current_tenant_id())
    and location_id = any ((select app.visible_location_ids())::uuid[])
  );

grant select on public.stock_movements to authenticated;
create policy stock_movements_select on public.stock_movements for select to authenticated
  using (
    tenant_id = (select app.current_tenant_id())
    and location_id = any ((select app.visible_location_ids())::uuid[])
  );

-- receipts: Store Room documents, managers only.
grant select on public.receipts, public.receipt_lines to authenticated;
create policy receipts_select on public.receipts for select to authenticated
  using (tenant_id = (select app.current_tenant_id()) and (select app.is_manager()));
create policy receipt_lines_select on public.receipt_lines for select to authenticated
  using (tenant_id = (select app.current_tenant_id()) and (select app.is_manager()));

-- restock requests: store staff see their store's requests in every status. Managers only see requests
-- once they have been sent â€” suggestions waiting for staff approval stay invisible to the Store Room.
grant select on public.restock_requests, public.restock_request_lines to authenticated;
create policy restock_requests_select on public.restock_requests for select to authenticated
  using (
    tenant_id = (select app.current_tenant_id())
    and (
      ((select app.current_app_role()) = 'STORE_STAFF' and location_id = any ((select app.visible_location_ids())::uuid[]))
      or ((select app.is_manager()) and status not in ('DRAFT', 'WAITING_STAFF_APPROVAL'))
    )
  );
create policy restock_request_lines_select on public.restock_request_lines for select to authenticated
  using (
    tenant_id = (select app.current_tenant_id())
    and exists (select 1 from public.restock_requests r where r.id = request_id)
  );

-- dispatches: managers see all; store staff see non-draft dispatches addressed to their store.
grant select on public.dispatches, public.dispatch_lines to authenticated;
create policy dispatches_select on public.dispatches for select to authenticated
  using (
    tenant_id = (select app.current_tenant_id())
    and (
      (select app.is_manager())
      or (status <> 'DRAFT' and to_location_id = any ((select app.visible_location_ids())::uuid[]))
    )
  );
create policy dispatch_lines_select on public.dispatch_lines for select to authenticated
  using (
    tenant_id = (select app.current_tenant_id())
    and exists (select 1 from public.dispatches d where d.id = dispatch_id)
  );

grant select on public.return_damage_entries to authenticated;
create policy return_damage_entries_select on public.return_damage_entries for select to authenticated
  using (
    tenant_id = (select app.current_tenant_id())
    and location_id = any ((select app.visible_location_ids())::uuid[])
  );

grant select, insert on public.label_print_log to authenticated;
grant usage on all sequences in schema public to authenticated;
create policy label_print_log_select on public.label_print_log for select to authenticated
  using (tenant_id = (select app.current_tenant_id()) and (select app.is_manager()));
create policy label_print_log_insert on public.label_print_log for insert to authenticated
  with check (
    tenant_id = (select app.current_tenant_id())
    and (select app.is_manager())
    and user_id = (select auth.uid())
  );

-- audit log: owner reads; nobody writes directly.
grant select on public.audit_log to authenticated;
create policy audit_log_select on public.audit_log for select to authenticated
  using (tenant_id = (select app.current_tenant_id()) and (select app.is_owner()));

-- api keys: owner reads metadata; the hash column is never granted.
grant select (id, tenant_id, name, prefix, created_by, created_at, last_used_at, revoked_at)
  on public.api_keys to authenticated;
create policy api_keys_select on public.api_keys for select to authenticated
  using (tenant_id = (select app.current_tenant_id()) and (select app.is_owner()));

-- tenant_counters and idempotency_keys: RLS on, no grants, no policies â€” internal only.
