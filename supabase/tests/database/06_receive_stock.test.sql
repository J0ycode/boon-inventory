-- Phase 3: receive_stock() and the stock rules it must uphold.
begin;
select plan(20);

create temporary table t (k text primary key, v jsonb);
grant all on t to authenticated;

-- Two boonbaby products and the boonbaby supplier.
insert into t values
  ('p1', to_jsonb((select id from public.products where tenant_id = tests.id('boonbaby') and sku = 'CLO-00001'))),
  ('p2', to_jsonb((select id from public.products where tenant_id = tests.id('boonbaby') and sku = 'ACC-00001'))),
  ('sup', to_jsonb('10000000-0000-4000-8000-000000000201'::uuid)),
  ('room_before_p1', to_jsonb((select quantity from public.stock_levels
     where location_id = tests.id('boonbaby.room')
       and product_id = (select id from public.products where tenant_id = tests.id('boonbaby') and sku = 'CLO-00001')))),
  ('key', to_jsonb(gen_random_uuid()));

create function pg_temp.v(k text) returns jsonb language sql as $$ select v from t where t.k = $1 $$;
create function pg_temp.id(k text) returns uuid language sql as $$ select (v #>> '{}')::uuid from t where t.k = $1 $$;
grant execute on function pg_temp.v(text), pg_temp.id(text) to authenticated;

select tests.authenticate_as('storeroom@boonbaby.test');

insert into t select 'r1', public.receive_stock(
  pg_temp.id('sup'), 'INV-1001',
  jsonb_build_array(
    jsonb_build_object('product_id', pg_temp.id('p1'), 'quantity', 12, 'unit_cost', 300),
    jsonb_build_object('product_id', pg_temp.id('p2'), 'quantity', 5)),
  'First delivery', pg_temp.id('key'));

select matches(pg_temp.v('r1') ->> 'number', '^RCV-\d{5}$', 'receipt gets a document number');
select is((pg_temp.v('r1') ->> 'pieces')::int, 17, 'receipt reports total pieces');
select is(
  (select quantity from public.stock_levels where location_id = tests.id('boonbaby.room') and product_id = pg_temp.id('p1')),
  (pg_temp.v('room_before_p1') #>> '{}')::int + 12,
  'Store Room stock increases by the received quantity');
select is(
  (select count(*) from public.stock_movements where ref_id = (pg_temp.v('r1') ->> 'receipt_id')::uuid and type = 'RECEIPT'),
  2::bigint, 'every received line writes a RECEIPT ledger row');
select is((select count(*) from public.receipt_lines where receipt_id = (pg_temp.v('r1') ->> 'receipt_id')::uuid), 2::bigint,
  'receipt lines are stored');
select is((select cost_price from public.product_costs where product_id = pg_temp.id('p1')), 300.00,
  'a given unit cost updates the product cost');

-- Idempotency: repeating the same request returns the first result and changes nothing.
select is(
  public.receive_stock(pg_temp.id('sup'), 'INV-1001',
    jsonb_build_array(jsonb_build_object('product_id', pg_temp.id('p1'), 'quantity', 12)), null, pg_temp.id('key')),
  pg_temp.v('r1'), 'a retried request returns the original result');
select is(
  (select quantity from public.stock_levels where location_id = tests.id('boonbaby.room') and product_id = pg_temp.id('p1')),
  (pg_temp.v('room_before_p1') #>> '{}')::int + 12,
  'a retried request does not receive the stock twice');

-- Validation.
select throws_ok(
  format($$ select public.receive_stock(%L, 'inv-1001', '[{"product_id":"%s","quantity":1}]') $$, pg_temp.id('sup'), pg_temp.id('p1')),
  'P0001', 'Invoice inv-1001 from this supplier was already received. Check before receiving it again.',
  'the same supplier invoice cannot be received twice');
select throws_ok(
  format($$ select public.receive_stock(%L, 'X1', '[{"product_id":"%s","quantity":0}]') $$, pg_temp.id('sup'), pg_temp.id('p1')),
  'P0001', 'Quantities must be whole numbers between 1 and 100,000.', 'zero quantity is rejected');
select throws_ok(
  format($$ select public.receive_stock(%L, 'X2', '[{"product_id":"%s","quantity":1.5}]') $$, pg_temp.id('sup'), pg_temp.id('p1')),
  'P0001', 'Quantities must be whole numbers between 1 and 100,000.', 'fractional pieces are rejected');
select throws_ok(
  format($$ select public.receive_stock(%L, 'X3', '[{"product_id":"%s","quantity":1},{"product_id":"%s","quantity":2}]') $$,
    pg_temp.id('sup'), pg_temp.id('p1'), pg_temp.id('p1')),
  'P0001', 'A product is listed more than once. Combine the quantities into one line.', 'duplicate lines are rejected');
select throws_ok(
  format($$ select public.receive_stock(%L, 'X4', '[]') $$, pg_temp.id('sup')),
  'P0001', 'Add at least one product.', 'an empty receipt is rejected');
select throws_ok(
  format($$ select public.receive_stock(%L, 'X5', '[{"product_id":"%s","quantity":1}]') $$, pg_temp.id('sup'),
    (select id from public.products where tenant_id = tests.id('tinytots') limit 1)),
  'P0001', 'One of the products was not found or is inactive.', 'another tenant''s product cannot be received');
select throws_ok(
  format($$ select public.receive_stock('20000000-0000-4000-8000-000000000201', 'X6', '[{"product_id":"%s","quantity":1}]') $$,
    pg_temp.id('p1')),
  'P0001', 'Choose the supplier this delivery came from.', 'another tenant''s supplier is rejected');

-- Roles.
select tests.authenticate_as('storea@boonbaby.test');
select throws_ok(
  format($$ select public.receive_stock(%L, 'X7', '[{"product_id":"%s","quantity":1}]') $$, pg_temp.id('sup'), pg_temp.id('p1')),
  'P0001', 'You do not have permission to do this.', 'store staff cannot receive stock');

select tests.authenticate_as('owner@boonbaby.test');
select lives_ok(
  format($$ select public.receive_stock(%L, 'OWN-1', '[{"product_id":"%s","quantity":3}]') $$, pg_temp.id('sup'), pg_temp.id('p2')),
  'the owner can receive stock');

-- Read-only tenants.
select tests.clear_authentication();
update public.tenants set status = 'past_due' where id = tests.id('boonbaby');
select tests.authenticate_as('storeroom@boonbaby.test');
select throws_ok(
  format($$ select public.receive_stock(%L, 'PD-1', '[{"product_id":"%s","quantity":1}]') $$, pg_temp.id('sup'), pg_temp.id('p1')),
  'P0001', 'Your subscription payment is overdue. The account is read-only until it is paid.',
  'a past-due tenant cannot change stock');

select tests.clear_authentication();
select ok(
  (select count(*) from public.audit_log where action = 'receipt.created' and tenant_id = tests.id('boonbaby')) >= 2,
  'receipts are audited');
select is(
  (select count(*) from public.stock_levels sl
   where sl.quantity <> coalesce((select sum(m.quantity_delta) from public.stock_movements m
                                  where m.product_id = sl.product_id and m.location_id = sl.location_id), 0)),
  0::bigint, 'ledger invariant still holds');

select * from finish();
rollback;
