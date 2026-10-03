-- Structural security guarantees: RLS everywhere, no implicit grants, ledger tables write-protected.
begin;
select plan(9);

select is(
  (select array_agg(tablename::text order by tablename) from pg_tables where schemaname = 'public' and not rowsecurity),
  null,
  'RLS is enabled on every table in public'
);

select is(
  (select array_agg(c.relname::text order by c.relname)
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and has_table_privilege('anon', c.oid, 'SELECT')),
  null,
  'anon cannot SELECT any public table'
);

select is(
  (select array_agg(t order by t) from unnest(array[
     'stock_levels', 'stock_movements', 'audit_log', 'receipts', 'receipt_lines', 'dispatches', 'dispatch_lines',
     'restock_requests', 'restock_request_lines', 'return_damage_entries', 'api_keys', 'tenant_counters',
     'idempotency_keys', 'locations', 'profile_locations'
   ]) as t
   where has_table_privilege('authenticated', 'public.' || t, 'INSERT')
      or has_table_privilege('authenticated', 'public.' || t, 'DELETE')
      or has_table_privilege('authenticated', 'public.' || t, 'TRUNCATE')),
  null,
  'authenticated cannot INSERT/DELETE/TRUNCATE stock, ledger, or document tables'
);

select is(
  (select array_agg(t order by t) from unnest(array[
     'stock_levels', 'stock_movements', 'audit_log', 'receipts', 'dispatches', 'restock_requests',
     'return_damage_entries', 'tenant_counters', 'idempotency_keys'
   ]) as t
   where has_table_privilege('authenticated', 'public.' || t, 'UPDATE')),
  null,
  'authenticated cannot UPDATE stock, ledger, or document tables'
);

select ok(
  not has_table_privilege('authenticated', 'public.tenant_counters', 'SELECT')
  and not has_table_privilege('authenticated', 'public.idempotency_keys', 'SELECT'),
  'internal bookkeeping tables are not readable by clients'
);

select ok(
  not has_column_privilege('authenticated', 'public.api_keys', 'key_hash', 'SELECT'),
  'API key hashes are never readable by clients'
);

select ok(
  not has_column_privilege('authenticated', 'public.tenants', 'status', 'UPDATE')
  and not has_column_privilege('authenticated', 'public.tenants', 'plan', 'UPDATE'),
  'clients cannot change their own plan or billing status'
);

select is(
  (select array_agg(p.proname::text order by p.proname)
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and has_function_privilege('authenticated', p.oid, 'EXECUTE')),
  array['current_app_role', 'current_tenant_id', 'day_start', 'is_manager', 'is_owner', 'visible_location_ids'],
  'only the RLS helpers (and the pure day_start date helper) in app are executable by clients'
);

select is(
  (select array_agg(p.proname::text order by p.proname)
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE')),
  array['tenant_public_info'],
  'anon can only call tenant_public_info'
);

select * from finish();
rollback;
