-- Store staff only ever see and touch their own store. Enforced by RLS, not by the UI.
begin;
select plan(13);

select tests.authenticate_as('storea@boonbaby.test');

select ok((select count(*) from public.stock_levels where location_id = tests.id('boonbaby.storeA')) > 0,
  'store A staff see store A stock');
select is((select count(*) from public.stock_levels where location_id <> tests.id('boonbaby.storeA')), 0::bigint,
  'store A staff see no stock at any other location (store B or Store Room)');
select is((select count(*) from public.stock_movements where location_id <> tests.id('boonbaby.storeA')), 0::bigint,
  'store A staff see no stock movements at any other location');

select is(
  (select array_agg(id order by name) from public.locations),
  array[tests.id('boonbaby.storeA'), tests.id('boonbaby.room')],
  'store A staff see only their store and the Store Room — never store B'
);

select is((select count(*) from public.product_costs), 0::bigint, 'store staff can never read cost prices');
select is((select count(*) from public.suppliers), 0::bigint, 'store staff cannot read suppliers');
select is((select count(*) from public.receipts), 0::bigint, 'store staff cannot read Store Room receipts');
select is((select count(*) from public.audit_log), 0::bigint, 'store staff cannot read the audit log');
select is((select count(*) from public.profiles), 1::bigint, 'store staff see only their own profile');

select is(
  (select jsonb_array_length(public.my_context() -> 'locations')),
  1,
  'my_context lists only the staff member''s own store'
);

-- Writes outside their remit.
update public.products set selling_price = 1 where tenant_id = tests.id('boonbaby');
select throws_ok(
  $$ insert into public.product_costs (product_id, tenant_id, cost_price)
     select id, tenant_id, 1 from public.products limit 1 $$,
  '42501', null,
  'store staff cannot write cost prices'
);

select tests.authenticate_as('storeb@boonbaby.test');
select is((select count(*) from public.stock_levels where location_id = tests.id('boonbaby.storeA')), 0::bigint,
  'store B staff cannot see store A stock');

select tests.clear_authentication();
select is((select count(*) from public.products where selling_price = 1), 0::bigint,
  'store staff product edits changed nothing');

select * from finish();
rollback;
