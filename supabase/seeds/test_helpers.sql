-- Helpers for pgTAP database tests (supabase/tests). Loaded as a seed file, so it exists locally and in CI
-- but is never deployed by `supabase db push`.

create schema if not exists tests;
grant usage on schema tests to anon, authenticated, service_role;

-- Definer so the lookup works even when the test is already running as `authenticated`.
create or replace function tests.user_id(p_email text)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select id from auth.users where email = p_email
$$;

-- Act as a seeded user for the rest of the transaction: switches to the `authenticated` role and sets the
-- JWT claims that auth.uid() reads. (Not SECURITY DEFINER: it must change the caller's role.)
create or replace function tests.authenticate_as(p_email text)
returns void
language plpgsql
as $$
declare
  v_user_id uuid := tests.user_id(p_email);
begin
  if v_user_id is null then
    raise exception 'tests.authenticate_as: no user with email %', p_email;
  end if;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_user_id, 'role', 'authenticated', 'email', p_email)::text, true);
end;
$$;

create or replace function tests.authenticate_as_anon()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
end;
$$;

create or replace function tests.clear_authentication()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', null, true);
end;
$$;

grant execute on all functions in schema tests to anon, authenticated;

-- For every public table with a tenant_id column, how many rows of `p_tenant_id` can the CURRENT role see?
-- SECURITY INVOKER on purpose: RLS and grants of the caller apply. Tables the caller has no SELECT grant on
-- report -1 (which is also "can't see anything").
create or replace function tests.visible_rows_of_tenant(p_tenant_id uuid)
returns table (table_name text, visible bigint)
language plpgsql
as $$
declare
  r record;
begin
  for r in
    select c.table_name::text as t
    from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public' and c.column_name = 'tenant_id' and tb.table_type = 'BASE TABLE'
    order by 1
  loop
    table_name := r.t;
    begin
      execute format('select count(*) from public.%I where tenant_id = $1', r.t) into visible using p_tenant_id;
    exception when insufficient_privilege then
      visible := -1;
    end;
    return next;
  end loop;
end;
$$;

-- Well-known seed IDs.
create or replace function tests.id(p_name text)
returns uuid
language sql immutable
as $$
  select case p_name
    when 'boonbaby' then '10000000-0000-4000-8000-000000000000'
    when 'boonbaby.room' then '10000000-0000-4000-8000-000000000010'
    when 'boonbaby.storeA' then '10000000-0000-4000-8000-000000000011'
    when 'boonbaby.storeB' then '10000000-0000-4000-8000-000000000012'
    when 'tinytots' then '20000000-0000-4000-8000-000000000000'
    when 'tinytots.room' then '20000000-0000-4000-8000-000000000010'
    when 'tinytots.storeA' then '20000000-0000-4000-8000-000000000011'
    when 'tinytots.storeB' then '20000000-0000-4000-8000-000000000012'
  end::uuid
$$;
grant execute on function tests.id(text) to anon, authenticated;

-- Re-grant so functions defined above are callable after switching roles.
grant execute on all functions in schema tests to anon, authenticated, service_role;
