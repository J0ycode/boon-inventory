-- Stock only changes through app.apply_stock_movement, which never goes negative and always writes the ledger.
begin;
select plan(10);

-- Clients cannot touch stock or the ledger directly.
select tests.authenticate_as('owner@boonbaby.test');
select throws_ok($$ update public.stock_levels set quantity = 999 $$, '42501', null,
  'OWNER cannot update stock_levels directly');
select throws_ok(
  $$ insert into public.stock_movements (tenant_id, product_id, location_id, type, quantity_delta, quantity_after)
     select tenant_id, product_id, location_id, 'ADJUSTMENT', 1, 1 from public.stock_levels limit 1 $$,
  '42501', null, 'OWNER cannot insert ledger rows directly');
select throws_ok($$ delete from public.stock_movements $$, '42501', null, 'OWNER cannot delete ledger rows');
select throws_ok($$ insert into public.audit_log (tenant_id, action, entity_type) values (tests.id('boonbaby'), 'x', 'y') $$,
  '42501', null, 'OWNER cannot write the audit log directly');
select throws_ok(
  $$ select app.apply_stock_movement(tests.id('boonbaby'), gen_random_uuid(), tests.id('boonbaby.room'), 'ADJUSTMENT', 1, null, null) $$,
  '42501', null, 'clients cannot call the internal stock primitive');

select tests.clear_authentication();

-- The primitive itself.
create temporary table t_target as
  select product_id, location_id, quantity from public.stock_levels
  where location_id = tests.id('boonbaby.storeA') and quantity > 0 limit 1;

select throws_ok(
  format($$ select app.apply_stock_movement(%L, %L, %L, 'SALE', %s, null, null) $$,
    tests.id('boonbaby'), (select product_id from t_target), (select location_id from t_target),
    -((select quantity from t_target) + 1)),
  'P0001', null,
  'stock can never go negative'
);

select is(
  app.apply_stock_movement(tests.id('boonbaby'), (select product_id from t_target), (select location_id from t_target),
    'SALE', -(select quantity from t_target), 'test', null, 'sell everything'),
  0,
  'selling exactly the available quantity leaves zero'
);

select is(
  (select quantity_after from public.stock_movements where ref_type = 'test' order by id desc limit 1),
  0,
  'the movement records the resulting quantity'
);

select throws_ok(
  format($$ select app.apply_stock_movement(%L, %L, %L, 'SALE', -1, null, null) $$,
    tests.id('tinytots'), (select product_id from t_target), (select location_id from t_target)),
  null, null,
  'a movement cannot mix one tenant''s id with another tenant''s product/location'
);

-- Ledger invariant: the sum of movements equals the stock level for every product/location.
select is(
  (select count(*) from public.stock_levels sl
   where sl.quantity <> coalesce((select sum(m.quantity_delta) from public.stock_movements m
                                  where m.product_id = sl.product_id and m.location_id = sl.location_id), 0)),
  0::bigint,
  'ledger invariant holds: sum(quantity_delta) = stock_levels.quantity everywhere'
);

select * from finish();
rollback;
