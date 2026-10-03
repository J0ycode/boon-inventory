-- Phase 6: returns & damage approval, sales (API + billing), API keys.
begin;
select plan(30);

create temporary table t (k text primary key, v text);
grant all on t to authenticated, service_role;
create function pg_temp.g(k text) returns text language sql as $$ select v from t where t.k = $1 $$;
grant execute on function pg_temp.g(text) to authenticated, service_role;
create function pg_temp.qty(p uuid, l uuid) returns integer language sql as $$
  select coalesce((select quantity from public.stock_levels where product_id = p and location_id = l), 0) $$;
grant execute on function pg_temp.qty(uuid, uuid) to authenticated, service_role;

insert into t values
  ('p', (select id::text from public.products where tenant_id = tests.id('boonbaby') and barcode = 'BB0000000004')),
  ('p2', (select id::text from public.products where tenant_id = tests.id('boonbaby') and barcode = 'BB0000000005'));
insert into t values
  ('a0', pg_temp.qty(pg_temp.g('p')::uuid, tests.id('boonbaby.storeA'))::text),
  ('r0', pg_temp.qty(pg_temp.g('p')::uuid, tests.id('boonbaby.room'))::text);

-- ---------------------------------------------------------------------------
-- Returns & damage
-- ---------------------------------------------------------------------------
select tests.authenticate_as('storea@boonbaby.test');
insert into t select 'ret', public.create_return_damage_entry(tests.id('boonbaby.storeA'), 'RETURN_TO_STOREROOM',
  pg_temp.g('p')::uuid, 3, 'Customer exchange — excess stock')::text;
insert into t select 'dmg', public.create_return_damage_entry(tests.id('boonbaby.storeA'), 'DAMAGE',
  pg_temp.g('p')::uuid, 1, 'Stain on fabric')::text;

select is(pg_temp.g('ret')::jsonb ->> 'status', 'PENDING', 'a store return waits for approval');
select is(pg_temp.qty(pg_temp.g('p')::uuid, tests.id('boonbaby.storeA')), pg_temp.g('a0')::int,
  'stock does not change until approved');
select throws_like(
  format($$ select public.create_return_damage_entry(%L, 'DAMAGE', %L, 100000, 'x') $$, tests.id('boonbaby.storeA'), pg_temp.g('p')),
  'Only % in stock here%', 'cannot return more than is on hand');
select throws_ok(
  format($$ select public.create_return_damage_entry(%L, 'SUPPLIER_RETURN', %L, 1, 'x') $$, tests.id('boonbaby.storeA'), pg_temp.g('p')),
  'P0001', 'Stores can return stock to the Store Room or report damage.', 'stores cannot return to suppliers');
select throws_ok(
  format($$ select public.create_return_damage_entry(%L, 'DAMAGE', %L, 1, 'x') $$, tests.id('boonbaby.storeB'), pg_temp.g('p')),
  'P0001', 'You can only work with your own store.', 'staff cannot file entries for another store');
select throws_ok(
  format($$ select public.decide_return_damage(%L, true) $$, (pg_temp.g('ret')::jsonb ->> 'entry_id')),
  'P0001', 'You do not have permission to do this.', 'staff cannot approve their own entries');

select tests.authenticate_as('storeroom@boonbaby.test');
select lives_ok(format($$ select public.decide_return_damage(%L, true) $$, (pg_temp.g('ret')::jsonb ->> 'entry_id')),
  'manager approves the return');
select is(pg_temp.qty(pg_temp.g('p')::uuid, tests.id('boonbaby.storeA')), pg_temp.g('a0')::int - 3, 'approved return leaves the store');
select is(pg_temp.qty(pg_temp.g('p')::uuid, tests.id('boonbaby.room')), pg_temp.g('r0')::int + 3, '... and arrives in the Store Room');
select throws_ok(format($$ select public.decide_return_damage(%L, false, '') $$, (pg_temp.g('dmg')::jsonb ->> 'entry_id')),
  'P0001', 'Tell the store why this is rejected.', 'rejecting needs a reason');
select lives_ok(format($$ select public.decide_return_damage(%L, false, 'Clean and sell') $$, (pg_temp.g('dmg')::jsonb ->> 'entry_id')),
  'manager rejects the damage report');
select is(pg_temp.qty(pg_temp.g('p')::uuid, tests.id('boonbaby.storeA')), pg_temp.g('a0')::int - 3, 'a rejected entry changes nothing');
select throws_ok(format($$ select public.decide_return_damage(%L, true) $$, (pg_temp.g('dmg')::jsonb ->> 'entry_id')),
  'P0001', 'This entry has already been decided.', 'decisions are final');

-- Managers at the Store Room: applied immediately.
select is(public.create_return_damage_entry(tests.id('boonbaby.room'), 'SUPPLIER_RETURN', pg_temp.g('p')::uuid, 2, 'Wrong colour') ->> 'status',
  'APPROVED', 'a Store Room supplier return applies immediately');
select is(pg_temp.qty(pg_temp.g('p')::uuid, tests.id('boonbaby.room')), pg_temp.g('r0')::int + 1, 'supplier return reduces Store Room stock');

-- ---------------------------------------------------------------------------
-- Sales via the billing RPC
-- ---------------------------------------------------------------------------
insert into t values ('a1', pg_temp.qty(pg_temp.g('p')::uuid, tests.id('boonbaby.storeA'))::text);
select tests.authenticate_as('storea@boonbaby.test');
insert into t select 'sale1', public.record_sale(tests.id('boonbaby.storeA'), 'BILL-0001',
  '[{"barcode":"BB0000000004","quantity":1},{"barcode":"BB0000000004","quantity":1}]')::text;
select is(pg_temp.qty(pg_temp.g('p')::uuid, tests.id('boonbaby.storeA')), pg_temp.g('a1')::int - 2,
  'a sale reduces store stock (same barcode twice is summed)');
select is((pg_temp.g('sale1')::jsonb -> 'lines' -> 0 ->> 'remaining')::int, pg_temp.g('a1')::int - 2, 'the response reports remaining stock');
select is(public.record_sale(tests.id('boonbaby.storeA'), 'BILL-0001', '[{"barcode":"BB0000000004","quantity":1}]') ->> 'duplicate',
  'true', 'a repeated external_ref returns the original sale');
select is(pg_temp.qty(pg_temp.g('p')::uuid, tests.id('boonbaby.storeA')), pg_temp.g('a1')::int - 2, '... without selling again');
select throws_ok($$ select public.record_sale(tests.id('boonbaby.storeA'), 'BILL-0002', '[{"barcode":"NOPE-1","quantity":1}]') $$,
  'P0001', 'Unknown barcode(s): NOPE-1', 'unknown barcodes are rejected by name');
select throws_like($$ select public.record_sale(tests.id('boonbaby.storeA'), 'BILL-0003', '[{"barcode":"BB0000000004","quantity":99999}]') $$,
  'Not enough stock of %', 'a sale cannot take stock below zero');
select throws_ok($$ select public.record_sale(tests.id('boonbaby.storeB'), 'BILL-0004', '[{"barcode":"BB0000000004","quantity":1}]') $$,
  'P0001', 'You can only work with your own store.', 'staff can only sell from their own store');
select throws_ok($$ select public.record_sale(tests.id('boonbaby.room'), 'BILL-0005', '[{"barcode":"BB0000000004","quantity":1}]') $$,
  'P0001', 'You can only work with your own store.', 'sales never come from the Store Room');

-- ---------------------------------------------------------------------------
-- API keys + api_record_sale (service role, as the Edge Function calls it)
-- ---------------------------------------------------------------------------
select tests.authenticate_as('owner@boonbaby.test');
insert into t select 'key', public.create_api_key('Billing counter')::text;
select matches(pg_temp.g('key')::jsonb ->> 'key', '^bb_live_[0-9a-f]{8}_[A-Za-z0-9xyz]{32}$', 'API key has the documented format');
select is((select count(*) from public.api_keys where prefix = pg_temp.g('key')::jsonb ->> 'prefix'), 1::bigint,
  'the owner sees key metadata');
select throws_ok($$ select key_hash from public.api_keys $$, '42501', null, 'the key hash is never readable');

select tests.clear_authentication();
set local role service_role;
select is(
  (public.api_record_sale(pg_temp.g('key')::jsonb ->> 'key', tests.id('boonbaby.storeA'), 'API-0001',
     '[{"barcode":"BB0000000005","quantity":1}]') ->> 'duplicate'),
  'false', 'a valid API key records a sale');
select throws_ok(
  format($$ select public.api_record_sale(%L, %L, 'API-0002', '[{"barcode":"BB0000000005","quantity":1}]') $$,
    (pg_temp.g('key')::jsonb ->> 'key') || 'x', tests.id('boonbaby.storeA')),
  'P0001', 'The API key is missing, invalid, or revoked.', 'a wrong key is rejected');
select throws_ok(
  format($$ select public.api_record_sale(%L, %L, 'API-0003', '[{"barcode":"TT0000000001","quantity":1}]') $$,
    pg_temp.g('key')::jsonb ->> 'key', tests.id('tinytots.storeA')),
  'P0001', 'location_id is not an active store of this shop.', 'a key cannot touch another tenant''s store');
reset role;

select tests.authenticate_as('owner@boonbaby.test');
insert into t select 'key2', public.rotate_api_key((pg_temp.g('key')::jsonb ->> 'id')::uuid)::text;
select tests.clear_authentication();
set local role service_role;
select throws_ok(
  format($$ select public.api_record_sale(%L, %L, 'API-0004', '[{"barcode":"BB0000000005","quantity":1}]') $$,
    pg_temp.g('key')::jsonb ->> 'key', tests.id('boonbaby.storeA')),
  'P0001', 'The API key is missing, invalid, or revoked.', 'the rotated-out key stops working');
reset role;

select * from finish();
rollback;
