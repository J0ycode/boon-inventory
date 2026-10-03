-- Phase 4: dispatch lifecycle, store receipt with issues, discrepancy resolution.
begin;
select plan(26);

create temporary table t (k text primary key, v text);
grant all on t to authenticated;
create function pg_temp.g(k text) returns text language sql as $$ select v from t where t.k = $1 $$;
grant execute on function pg_temp.g(text) to authenticated;
create function pg_temp.qty(p uuid, l uuid) returns integer language sql as $$
  select coalesce((select quantity from public.stock_levels where product_id = p and location_id = l), 0) $$;
grant execute on function pg_temp.qty(uuid, uuid) to authenticated;

insert into t values
  ('p1', (select id::text from public.products where tenant_id = tests.id('boonbaby') and sku = 'CLO-00003')),
  ('p2', (select id::text from public.products where tenant_id = tests.id('boonbaby') and sku = 'ACC-00009'));
insert into t values
  ('room_p1', pg_temp.qty(pg_temp.g('p1')::uuid, tests.id('boonbaby.room'))::text),
  ('room_p2', pg_temp.qty(pg_temp.g('p2')::uuid, tests.id('boonbaby.room'))::text),
  ('a_p1', pg_temp.qty(pg_temp.g('p1')::uuid, tests.id('boonbaby.storeA'))::text),
  ('a_p2', pg_temp.qty(pg_temp.g('p2')::uuid, tests.id('boonbaby.storeA'))::text);

-- ---------------------------------------------------------------------------
-- Draft
-- ---------------------------------------------------------------------------
select tests.authenticate_as('storeroom@boonbaby.test');
insert into t select 'd1', public.save_dispatch_draft(null, tests.id('boonbaby.storeA'),
  format('[{"product_id":"%s","quantity":10},{"product_id":"%s","quantity":4}]', pg_temp.g('p1'), pg_temp.g('p2'))::jsonb,
  'Weekly top-up')::text;

select is((select status::text from public.dispatches where id = pg_temp.g('d1')::uuid), 'DRAFT', 'a new dispatch is a draft');
select is(pg_temp.qty(pg_temp.g('p1')::uuid, tests.id('boonbaby.room')), pg_temp.g('room_p1')::int,
  'a draft does not change stock');
select throws_ok(
  format($$ select public.save_dispatch_draft(null, %L, '[{"product_id":"%s","quantity":1}]') $$,
    tests.id('boonbaby.room'), pg_temp.g('p1')),
  'P0001', 'Choose the store to send to.', 'dispatches only go to stores, not the Store Room');

-- Store staff cannot see drafts addressed to them.
select tests.authenticate_as('storea@boonbaby.test');
select is((select count(*) from public.dispatches where id = pg_temp.g('d1')::uuid), 0::bigint,
  'store staff cannot see a draft');
select throws_ok(format($$ select public.send_dispatch(%L) $$, pg_temp.g('d1')), 'P0001',
  'You do not have permission to do this.', 'store staff cannot send dispatches');

-- ---------------------------------------------------------------------------
-- Send
-- ---------------------------------------------------------------------------
select tests.authenticate_as('storeroom@boonbaby.test');
insert into t values ('k1', gen_random_uuid()::text);
select lives_ok(format($$ select public.send_dispatch(%L, %L) $$, pg_temp.g('d1'), pg_temp.g('k1')), 'manager sends the dispatch');
select lives_ok(format($$ select public.send_dispatch(%L, %L) $$, pg_temp.g('d1'), pg_temp.g('k1')),
  'a retried send with the same key is harmless');
select is(pg_temp.qty(pg_temp.g('p1')::uuid, tests.id('boonbaby.room')), pg_temp.g('room_p1')::int - 10,
  'sending deducts Store Room stock exactly once');
select is((select status::text from public.dispatches where id = pg_temp.g('d1')::uuid), 'DISPATCHED', 'status is Dispatched');
select is(
  (select count(*) from public.stock_movements where ref_id = pg_temp.g('d1')::uuid and type = 'DISPATCH_OUT'),
  2::bigint, 'each line writes a DISPATCH_OUT movement');
select throws_ok(format($$ select public.send_dispatch(%L) $$, pg_temp.g('d1')), 'P0001',
  'This dispatch has already been sent.', 'a dispatch cannot be sent twice (new key)');
select throws_ok(
  format($$ select public.save_dispatch_draft(%L, %L, '[{"product_id":"%s","quantity":1}]') $$,
    pg_temp.g('d1'), tests.id('boonbaby.storeA'), pg_temp.g('p1')),
  'P0001', 'This dispatch has already been sent and can''t be edited.', 'a sent dispatch cannot be edited');

-- Not enough stock: sending more than the Store Room has fails and changes nothing.
insert into t select 'd2', public.save_dispatch_draft(null, tests.id('boonbaby.storeB'),
  format('[{"product_id":"%s","quantity":%s}]', pg_temp.g('p2'), pg_temp.g('room_p2')::int + 1)::jsonb)::text;
select throws_like(format($$ select public.send_dispatch(%L) $$, pg_temp.g('d2')),
  'Not enough stock of %', 'sending more than is in stock is refused with a clear message');
select is(pg_temp.qty(pg_temp.g('p2')::uuid, tests.id('boonbaby.room')), pg_temp.g('room_p2')::int - 4,
  'a refused send leaves stock unchanged');

-- ---------------------------------------------------------------------------
-- Store receipt
-- ---------------------------------------------------------------------------
select tests.authenticate_as('storeb@boonbaby.test');
select is((select count(*) from public.dispatches where id = pg_temp.g('d1')::uuid), 0::bigint,
  'store B cannot see store A''s delivery');

select tests.authenticate_as('storea@boonbaby.test');
insert into t select 'l1', id::text from public.dispatch_lines where dispatch_id = pg_temp.g('d1')::uuid and product_id = pg_temp.g('p1')::uuid;
insert into t select 'l2', id::text from public.dispatch_lines where dispatch_id = pg_temp.g('d1')::uuid and product_id = pg_temp.g('p2')::uuid;

select throws_ok(
  format($$ select public.receive_dispatch(%L, '[{"line_id":"%s","received":9},{"line_id":"%s","received":4}]') $$,
    pg_temp.g('d1'), pg_temp.g('l1'), pg_temp.g('l2')),
  'P0001', 'Received, missing, and damaged must add up to 10 for each line.', 'quantities must add up to what was sent');
select throws_ok(
  format($$ select public.receive_dispatch(%L, '[{"line_id":"%s","received":8,"missing":2},{"line_id":"%s","received":4}]') $$,
    pg_temp.g('d1'), pg_temp.g('l1'), pg_temp.g('l2')),
  'P0001', 'Add a note explaining the missing or damaged pieces.', 'missing or damaged pieces need a note');

select lives_ok(
  format($$ select public.receive_dispatch(%L,
    '[{"line_id":"%s","received":7,"missing":2,"damaged":1,"note":"Box torn"},{"line_id":"%s","received":4}]', %L) $$,
    pg_temp.g('d1'), pg_temp.g('l1'), pg_temp.g('l2'), gen_random_uuid()),
  'store staff confirm the delivery with issues');
select is(pg_temp.qty(pg_temp.g('p1')::uuid, tests.id('boonbaby.storeA')), pg_temp.g('a_p1')::int + 7,
  'only the good quantity is added to the store');
select is((select status::text from public.dispatches where id = pg_temp.g('d1')::uuid), 'RECEIVED_WITH_ISSUES',
  'status becomes Received with issues');

-- ---------------------------------------------------------------------------
-- Discrepancies
-- ---------------------------------------------------------------------------
select throws_ok(format($$ select public.resolve_discrepancy(%L, 'WRITE_OFF') $$, pg_temp.g('l1')), 'P0001',
  'You do not have permission to do this.', 'store staff cannot resolve discrepancies');

select tests.authenticate_as('storeroom@boonbaby.test');
select throws_ok(format($$ select public.resolve_discrepancy(%L, 'WRITE_OFF') $$, pg_temp.g('l2')), 'P0001',
  'This line has no open discrepancy.', 'a clean line has nothing to resolve');
select lives_ok(format($$ select public.resolve_discrepancy(%L, 'WRITE_OFF', 'Carrier damage') $$, pg_temp.g('l1')),
  'manager writes off the missing/damaged pieces');
select is(pg_temp.qty(pg_temp.g('p1')::uuid, tests.id('boonbaby.room')), pg_temp.g('room_p1')::int - 10,
  'a write-off nets to zero at the Store Room');
select is(
  (select array_agg(type::text || ':' || quantity_delta order by id) from public.stock_movements
   where ref_id = pg_temp.g('d1')::uuid and product_id = pg_temp.g('p1')::uuid and location_id = tests.id('boonbaby.room')
     and type in ('RETURN_IN', 'DAMAGE')),
  array['RETURN_IN:3', 'DAMAGE:-3'], 'the write-off is visible in the ledger');
select is((select status::text from public.dispatches where id = pg_temp.g('d1')::uuid), 'RESOLVED',
  'the dispatch is resolved once every issue is settled');

select * from finish();
rollback;
