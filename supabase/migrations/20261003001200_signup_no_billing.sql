-- No payments in this product: shops are active from signup and never lock for a trial or an unpaid subscription.
-- Only an explicitly canceled shop (set by the operator) becomes read-only.

alter table public.tenants alter column status set default 'active';
update public.tenants set status = 'active' where status in ('trial', 'past_due');

create or replace function app.assert_tenant_writable(p_tenant_id uuid)
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.tenants where id = p_tenant_id and status = 'canceled') then
    perform app.raise('BB_TENANT_CANCELED', 'This shop account has been closed. Data is read-only.');
  end if;
end;
$$;
revoke execute on function app.assert_tenant_writable(uuid) from public, anon, authenticated;

-- Signup from the root domain. The server creates the auth user with the service role, then calls this to create
-- the shop. Only service_role can execute it.
create function public.signup_create_tenant(
  p_user_id uuid,
  p_email text,
  p_owner_name text,
  p_shop_name text,
  p_slug text,
  p_store_name text default 'Store A'
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_tenant_id uuid;
begin
  if nullif(trim(p_owner_name), '') is null then
    perform app.raise('BB_NAME_REQUIRED', 'Enter your name.');
  end if;
  if nullif(trim(p_shop_name), '') is null or length(trim(p_shop_name)) > 80 then
    perform app.raise('BB_SHOP_NAME_REQUIRED', 'Enter your shop name (up to 80 characters).');
  end if;
  v_tenant_id := app.create_tenant_with_owner(p_user_id, lower(trim(p_email)), p_owner_name, p_shop_name, p_slug, p_store_name);
  return jsonb_build_object('tenant_id', v_tenant_id, 'slug', lower(trim(p_slug)));
end;
$$;
revoke execute on function public.signup_create_tenant(uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.signup_create_tenant(uuid, text, text, text, text, text) to service_role;

-- Public: is a shop address free? (Used live on the signup form.)
create function public.slug_available(p_slug text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select lower(trim(p_slug)) ~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$'
     and lower(trim(p_slug)) not in ('www', 'app', 'api', 'admin', 'auth', 'mail', 'static')
     and not exists (select 1 from public.tenants where slug = lower(trim(p_slug)));
$$;
revoke execute on function public.slug_available(text) from public;
grant execute on function public.slug_available(text) to anon, authenticated;

-- First-run checklist for owners: which setup steps are done.
create function public.setup_progress()
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object(
    'suppliers', exists (select 1 from public.suppliers),
    'products', exists (select 1 from public.products),
    'received', exists (select 1 from public.receipts),
    'team', (select count(*) from public.profiles) > 1,
    'dispatched', exists (select 1 from public.dispatches where status <> 'DRAFT')
  );
$$;
revoke execute on function public.setup_progress() from public, anon;
grant execute on function public.setup_progress() to authenticated;
