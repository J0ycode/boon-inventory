-- BoonBaby Store Manager — tenant bootstrap and session context.

-- Creates a tenant with its Store Room, first Store, and OWNER profile in one transaction.
-- Internal: called by public.create_tenant() (signup) and by the seed.
create function app.create_tenant_with_owner(
  p_user_id uuid,
  p_email text,
  p_owner_name text,
  p_shop_name text,
  p_slug text,
  p_store_name text default 'Store A'
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_tenant_id uuid;
  v_slug text := lower(trim(p_slug));
begin
  if exists (select 1 from public.profiles where user_id = p_user_id) then
    perform app.raise('BB_ALREADY_HAS_SHOP', 'This account already belongs to a shop.');
  end if;
  if v_slug !~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$' then
    perform app.raise('BB_INVALID_SLUG', 'Shop address must be 3–32 characters: lowercase letters, numbers, and hyphens.');
  end if;
  if exists (select 1 from public.tenants where slug = v_slug)
     or v_slug in ('www', 'app', 'api', 'admin', 'auth', 'mail', 'static') then
    perform app.raise('BB_SLUG_TAKEN', 'That shop address is already taken. Try another.');
  end if;

  insert into public.tenants (slug, name, email)
  values (v_slug, trim(p_shop_name), p_email)
  returning id into v_tenant_id;

  insert into public.locations (tenant_id, kind, name) values (v_tenant_id, 'STORE_ROOM', 'Store Room');
  insert into public.locations (tenant_id, kind, name)
  values (v_tenant_id, 'STORE', coalesce(nullif(trim(p_store_name), ''), 'Store A'));

  insert into public.profiles (user_id, tenant_id, role, full_name, email)
  values (p_user_id, v_tenant_id, 'OWNER', trim(p_owner_name), p_email);

  insert into public.audit_log (tenant_id, user_id, action, entity_type, entity_id, details)
  values (v_tenant_id, p_user_id, 'tenant.created', 'tenant', v_tenant_id, jsonb_build_object('slug', v_slug));

  return v_tenant_id;
end;
$$;

-- Signup RPC: the freshly signed-up user becomes OWNER of a new shop.
create function public.create_tenant(p_shop_name text, p_slug text, p_owner_name text, p_store_name text default 'Store A')
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_tenant_id uuid;
  v_email text;
begin
  if auth.uid() is null then
    perform app.raise('BB_NOT_SIGNED_IN', 'Please sign in again.');
  end if;
  select email into v_email from auth.users where id = auth.uid();
  v_tenant_id := app.create_tenant_with_owner(auth.uid(), v_email, p_owner_name, p_shop_name, p_slug, p_store_name);
  return jsonb_build_object('tenant_id', v_tenant_id, 'slug', lower(trim(p_slug)));
end;
$$;
revoke execute on function public.create_tenant(text, text, text, text) from public, anon;
grant execute on function public.create_tenant(text, text, text, text) to authenticated;

-- Public lookup used by the login page and the proxy to confirm a subdomain belongs to a real shop.
-- Returns only non-sensitive fields.
create function public.tenant_public_info(p_slug text)
returns table (slug text, name text)
language sql stable security definer set search_path = ''
as $$
  select t.slug, t.name from public.tenants t where t.slug = lower(p_slug)
$$;
revoke execute on function public.tenant_public_info(text) from public;
grant execute on function public.tenant_public_info(text) to anon, authenticated;

-- One round trip for the portal shell: who am I, which shop, which locations.
create function public.my_context()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'user_id', p.user_id,
    'full_name', p.full_name,
    'email', p.email,
    'role', p.role,
    'tenant', jsonb_build_object(
      'id', t.id, 'slug', t.slug, 'name', t.name, 'status', t.status, 'trial_ends_at', t.trial_ends_at
    ),
    'locations', coalesce((
      select jsonb_agg(jsonb_build_object('id', l.id, 'name', l.name, 'kind', l.kind) order by l.kind, l.name)
      from public.locations l
      where l.tenant_id = p.tenant_id
        and l.active
        and (p.role in ('OWNER', 'STOREROOM_MANAGER')
             or exists (select 1 from public.profile_locations pl where pl.user_id = p.user_id and pl.location_id = l.id))
    ), '[]'::jsonb)
  )
  from public.profiles p
  join public.tenants t on t.id = p.tenant_id
  where p.user_id = auth.uid() and p.active
$$;
revoke execute on function public.my_context() from public, anon;
grant execute on function public.my_context() to authenticated;

revoke execute on function app.create_tenant_with_owner(uuid, text, text, text, text, text) from public, anon, authenticated;
