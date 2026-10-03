-- Phase 5: restock requests — manual, suggested (staff approval), visibility, decision → draft dispatch.
begin;
select plan(22);

create temporary table t (k text primary key, v text);
grant all on t to authenticated;
create function pg_temp.g(k text) returns text language sql as $$ select v from t where t.k = $1 $$;
grant execute on function pg_temp.g(text) to authenticated;

-- Seed: store B has "Knitted Booties — Lavender" (reorder 5) at 0 and "Cotton Mittens" (reorder 6) at 3.
insert into t values
  ('booties', (select id::text from public.products where tenant_id = tests.id('boonbaby') and name like 'Knitted Booties%')),
  ('mittens', (select id::text from public.products where tenant_id = tests.id('boonbaby') and name like 'Cotton Mittens%')),
  ('socks', (select id::text from public.products where tenant_id = tests.id('boonbaby') and name like 'Socks Pack%'));

-- ---------------------------------------------------------------------------
-- Suggestions
-- ---------------------------------------------------------------------------
select tests.authenticate_as('storeb@boonbaby.test');
select ok((public.generate_restock_suggestions(tests.id('boonbaby.storeB')) ->> 'lines')::int > 0,
  'suggestions are generated for low-stock items');
insert into t select 'sreq', id::text from public.restock_requests
  where location_id = tests.id('boonbaby.storeB') and status = 'WAITING_STAFF_APPROVAL';

select is(
  (select quantity from public.restock_request_lines where request_id = pg_temp.g('sreq')::uuid and product_id = pg_temp.g('booties')::uuid),
  10, 'suggested quantity = reorder × 2 − on hand (5 × 2 − 0)');
select is(
  (select quantity from public.restock_request_lines where request_id = pg_temp.g('sreq')::uuid and product_id = pg_temp.g('mittens')::uuid),
  9, 'suggested quantity = 6 × 2 − 3');
select is((select status::text from public.restock_requests where id = pg_temp.g('sreq')::uuid),
  'WAITING_STAFF_APPROVAL', 'store staff see their suggestion, waiting for their approval');
select is((public.generate_restock_suggestions(tests.id('boonbaby.storeB')) ->> 'lines')::int, 0,
  'running suggestions again does not duplicate lines');
select is(
  (select count(*) from public.restock_requests where location_id = tests.id('boonbaby.storeB') and status = 'WAITING_STAFF_APPROVAL'),
  1::bigint, 'one waiting suggestion per store');

select throws_ok(format($$ select public.generate_restock_suggestions(%L) $$, tests.id('boonbaby.storeA')),
  'P0001', 'You can only work with your own store.', 'staff cannot generate suggestions for another store');

-- Invisible to the Store Room until forwarded.
select tests.authenticate_as('storeroom@boonbaby.test');
select is((select count(*) from public.restock_requests where id = pg_temp.g('sreq')::uuid), 0::bigint,
  'the Store Room cannot see a suggestion waiting for staff approval');
select is((select count(*) from public.restock_request_lines where request_id = pg_temp.g('sreq')::uuid), 0::bigint,
  '... nor its lines');
select tests.authenticate_as('owner@boonbaby.test');
select is((select count(*) from public.restock_requests where id = pg_temp.g('sreq')::uuid), 0::bigint,
  'the owner cannot see it either');

-- Staff review: approve one with an edit, skip one, the rest approved; forward.
select tests.authenticate_as('storeb@boonbaby.test');
select throws_ok(format($$ select public.forward_suggestions(%L) $$, pg_temp.g('sreq')), 'P0001',
  'Approve or skip every line before forwarding.', 'cannot forward with lines still pending');
select lives_ok(format($$ select public.review_suggestion_line(id, 'APPROVE', 12) from public.restock_request_lines
  where request_id = %L and product_id = %L $$, pg_temp.g('sreq'), pg_temp.g('booties')), 'staff approve with an edited quantity');
select lives_ok(format($$ select public.review_suggestion_line(id, 'SKIP') from public.restock_request_lines
  where request_id = %L and product_id = %L $$, pg_temp.g('sreq'), pg_temp.g('mittens')), 'staff skip a line');
select lives_ok(format($$ select public.review_suggestion_line(id, 'APPROVE') from public.restock_request_lines
  where request_id = %L and line_status = 'PENDING' $$, pg_temp.g('sreq')), 'staff approve the rest');
select lives_ok(format($$ select public.forward_suggestions(%L) $$, pg_temp.g('sreq')), 'staff forward to the Store Room');

select tests.authenticate_as('storeroom@boonbaby.test');
select is((select status::text from public.restock_requests where id = pg_temp.g('sreq')::uuid), 'SENT',
  'once forwarded the Store Room sees it as Sent');

-- ---------------------------------------------------------------------------
-- Decide
-- ---------------------------------------------------------------------------
select throws_ok(format($$ select public.decide_restock_request(%L, false, '') $$, pg_temp.g('sreq')), 'P0001',
  'Tell the store why the request is rejected.', 'rejecting needs a reason');
insert into t select 'decision', public.decide_restock_request(pg_temp.g('sreq')::uuid, true)::text;
select is((select status::text from public.restock_requests where id = pg_temp.g('sreq')::uuid), 'APPROVED', 'request approved');
select is(
  (select array_agg(product_id::text || ':' || quantity_sent order by product_id) from public.dispatch_lines
   where dispatch_id = (pg_temp.g('decision')::jsonb ->> 'dispatch_id')::uuid
     and product_id in (pg_temp.g('booties')::uuid, pg_temp.g('mittens')::uuid)),
  array[pg_temp.g('booties') || ':12'],
  'approval creates a draft dispatch with the approved (edited) lines only');
select is((select status::text from public.dispatches where id = (pg_temp.g('decision')::jsonb ->> 'dispatch_id')::uuid),
  'DRAFT', 'the dispatch starts as a draft');

-- Manual request by staff, sent directly.
select tests.authenticate_as('storea@boonbaby.test');
select lives_ok(format($$ select public.save_restock_request(null, %L, '[{"product_id":"%s","quantity":6}]', 'Weekend sale', true) $$,
  tests.id('boonbaby.storeA'), pg_temp.g('socks')), 'store staff send a manual request');
select throws_ok(format($$ select public.save_restock_request(null, %L, '[{"product_id":"%s","quantity":6}]') $$,
  tests.id('boonbaby.storeB'), pg_temp.g('socks')), 'P0001', 'You can only work with your own store.',
  'staff cannot request for another store');

select * from finish();
rollback;
