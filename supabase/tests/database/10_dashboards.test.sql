-- Phase 8: dashboard and notification figures respect role scope.
begin;
select plan(6);

select tests.authenticate_as('storea@boonbaby.test');
select is((select array_agg(location_id) from public.location_summary()), array[tests.id('boonbaby.storeA')],
  'store staff only get figures for their own store');
select is(
  (select pieces from public.location_summary()),
  (select sum(quantity) from public.stock_levels where location_id = tests.id('boonbaby.storeA')),
  'store pieces equal the sum of its stock levels');
select ok(public.notification_summary() ? 'incoming' and not (public.notification_summary() ? 'requests'),
  'staff notifications cover incoming deliveries, not Store Room approvals');

select tests.authenticate_as('storeroom@boonbaby.test');
select is((select count(*) from public.location_summary()), 3::bigint, 'managers see every location');
select ok(public.notification_summary() ?& array['requests', 'returns', 'discrepancies', 'low_stock'],
  'manager notifications cover approvals and low stock');

select tests.authenticate_as('owner@tinytots.test');
select is((select count(*) from public.location_summary() where location_id = tests.id('boonbaby.room')), 0::bigint,
  'another tenant''s locations never appear');

select * from finish();
rollback;
