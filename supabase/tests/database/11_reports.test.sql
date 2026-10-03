-- Phase 8: reports are scoped by RLS like everything else.
begin;
select plan(5);

select tests.authenticate_as('storea@boonbaby.test');
select is((select array_agg(distinct location) from public.report_stock()), array['Store A — MG Road'],
  'store staff stock report covers only their store');
select is((select array_agg(distinct location) from public.report_movements(current_date - 1, current_date)),
  array['Store A — MG Road'], 'store staff movement report covers only their store');

select tests.authenticate_as('storeroom@boonbaby.test');
select is((select count(distinct location) from public.report_stock()), 3::bigint, 'managers report on every location');
select ok((select bool_and(status in ('Low', 'Out of stock')) from public.report_stock(null, true)),
  'low-stock report only lists low or out-of-stock lines');
select is(
  (select total_count from public.report_movements(current_date - 1, current_date, tests.id('boonbaby.room'), null, 5) limit 1),
  (select count(*) from public.stock_movements where location_id = tests.id('boonbaby.room')),
  'paged report reports the full total');

select * from finish();
rollback;
