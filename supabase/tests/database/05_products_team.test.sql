-- Phase 2: catalogue rules, search scoping, import, team management.
begin;
select plan(24);

-- ---------------------------------------------------------------------------
-- save_product: generation, uniqueness, permissions, cost, audit
-- ---------------------------------------------------------------------------
select tests.authenticate_as('storeroom@boonbaby.test');

create temporary table t_ids (k text primary key, id uuid);
grant all on t_ids to authenticated;

insert into t_ids
select 'new', public.save_product(null, '  Test Romper  ', 'CLOTHING', '', '', 499, null, 3, true, 210);

select matches((select sku from public.products where id = (select id from t_ids where k = 'new')), '^CLO-\d{5}$',
  'blank SKU is generated as CLO-#####');
select matches((select barcode from public.products where id = (select id from t_ids where k = 'new')), '^BB\d{10}$',
  'blank barcode is generated as BB + 10 digits');
select is((select name from public.products where id = (select id from t_ids where k = 'new')), 'Test Romper',
  'name is trimmed');
select is((select cost_price from public.product_costs where product_id = (select id from t_ids where k = 'new')), 210.00,
  'cost price is saved with the product');
select ok(exists (select 1 from public.products where id = (select id from t_ids where k = 'new')),
  'manager can read the new product');

select throws_ok(
  $$ select public.save_product(null, 'Dup', 'ACCESSORY', null,
       (select barcode from public.products where id = (select id from t_ids where k = 'new')), 1, null, 0, true, null) $$,
  '23505', null, 'barcodes are unique per tenant');

select lives_ok(
  $$ select public.save_product((select id from t_ids where k = 'new'), 'Test Romper v2', 'CLOTHING',
       (select sku from public.products where id = (select id from t_ids where k = 'new')), null, 549, null, 3, true, null) $$,
  'manager can edit a product and clear its cost');
select is((select count(*) from public.product_costs where product_id = (select id from t_ids where k = 'new')), 0::bigint,
  'clearing the cost removes the cost row');

select tests.clear_authentication();
select ok(
  (select count(*) from public.audit_log where entity_id = (select id from t_ids where k = 'new')
     and action in ('products.insert', 'products.update')) >= 2,
  'product create and edit are audited');

-- Barcodes are only unique within a tenant.
select tests.authenticate_as('storeroom@tinytots.test');
select lives_ok(
  $$ select public.save_product(null, 'Same code elsewhere', 'ACCESSORY', null, 'BB0000000010', 1, null, 0, true, null) $$,
  'another tenant may reuse a barcode');

-- Store staff can't write the catalogue.
select tests.authenticate_as('storea@boonbaby.test');
select throws_ok(
  $$ select public.save_product(null, 'Nope', 'ACCESSORY', null, null, 1, null, 0, true, null) $$,
  'P0001', 'You do not have permission to do this.', 'store staff cannot create products');

-- ---------------------------------------------------------------------------
-- search_stock / find_product_by_code scoping
-- ---------------------------------------------------------------------------
select ok((select count(*) from public.search_stock(tests.id('boonbaby.storeA'))) > 0,
  'store staff can search their own store');
select is((select count(*) from public.search_stock(tests.id('boonbaby.storeB'))), 0::bigint,
  'store staff get nothing when searching another store');
select is((select count(*) from public.search_stock(tests.id('boonbaby.room'))), 0::bigint,
  'store staff get nothing when searching the Store Room');
select is(
  (select quantity from public.find_product_by_code('BB0000000001', tests.id('boonbaby.storeA'))),
  (select quantity from public.stock_levels sl join public.products p on p.id = sl.product_id
   where p.barcode = 'BB0000000001' and sl.location_id = tests.id('boonbaby.storeA')),
  'scanner lookup returns the store quantity');

select tests.authenticate_as('storeroom@boonbaby.test');
select is(
  (select total_count from public.search_stock(tests.id('boonbaby.room'), 'romper') limit 1),
  (select count(*) from public.products where name ilike '%romper%' and active),
  'search matches names case-insensitively and reports the total');
select is(
  (select sku from public.search_stock(tests.id('boonbaby.room'), 'BB0000000004') limit 1),
  (select sku from public.products where barcode = 'BB0000000004' and tenant_id = tests.id('boonbaby')),
  'exact barcode search returns that product first');
select ok(
  (select bool_and(quantity <= reorder_level) from public.search_stock(tests.id('boonbaby.storeB'), null, null, null, 'low')),
  'low-stock filter only returns items at or below their reorder level');

-- ---------------------------------------------------------------------------
-- import_products
-- ---------------------------------------------------------------------------
select is(
  (public.import_products('[{"name":"Imp A","category":"clothing","selling_price":"100"},
                            {"name":"","category":"shoes","selling_price":"abc"}]'::jsonb, true) ->> 'has_errors')::boolean,
  true, 'dry run reports row errors');
select throws_ok(
  $$ select public.import_products('[{"name":"Imp A","category":"CLOTHING"},{"name":"","category":"X"}]'::jsonb, false) $$,
  'P0001', null, 'an import with errors imports nothing');
select is(
  (public.import_products('[{"name":"Imp B","category":"ACCESSORY","sku":"IMP-B","cost_price":"12.5","supplier":"New Supplier Co"},
                            {"name":"Romper renamed","category":"CLOTHING","sku":"CLO-00001","selling_price":"700"}]'::jsonb, false)
   ->> 'created')::int,
  1, 'valid import creates new products');
select is((select name from public.products where sku = 'CLO-00001' and tenant_id = tests.id('boonbaby')), 'Romper renamed',
  'import updates existing products by SKU');

-- ---------------------------------------------------------------------------
-- Team management
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ select public.save_location(null, 'Store C', null) $$,
  'P0001', null, 'only the owner can add stores');

select tests.authenticate_as('owner@boonbaby.test');
select lives_ok(
  $$ select public.update_member(tests.user_id('storeb@boonbaby.test'), 'Joseph B', 'STORE_STAFF',
       array[tests.id('boonbaby.storeB')], false) $$,
  'owner can deactivate a staff member');

select * from finish();
rollback;
