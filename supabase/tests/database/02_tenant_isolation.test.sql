-- A user can never read or write another tenant's data, whatever their role.
begin;
select plan(15);

-- Sanity: as the superuser, both tenants have data in the main tables.
select ok(
  (select count(*) from public.products where tenant_id = tests.id('tinytots')) > 0
  and (select count(*) from public.stock_levels where tenant_id = tests.id('tinytots')) > 0,
  'fixture: tinytots has products and stock'
);

-- ---------------------------------------------------------------------------
-- Reads: every tenant-scoped table, every boonbaby role.
-- ---------------------------------------------------------------------------
select tests.authenticate_as('owner@boonbaby.test');
-- Positive control so the "zero rows" checks below can't pass vacuously.
select ok(
  (select count(*) from tests.visible_rows_of_tenant(tests.id('boonbaby')) where visible > 0) >= 5,
  'control: the helper does see the user''s own tenant across tables'
);
select is(
  (select array_agg(table_name order by table_name) from tests.visible_rows_of_tenant(tests.id('tinytots')) where visible > 0),
  null,
  'OWNER sees zero rows of another tenant in every table'
);
select is((select count(*) from public.tenants where id = tests.id('tinytots')), 0::bigint,
  'OWNER cannot see the other tenant row');
select ok((select count(*) from public.products) > 0, 'OWNER does see their own products');

select tests.authenticate_as('storeroom@boonbaby.test');
select is(
  (select array_agg(table_name order by table_name) from tests.visible_rows_of_tenant(tests.id('tinytots')) where visible > 0),
  null,
  'STOREROOM_MANAGER sees zero rows of another tenant in every table'
);

select tests.authenticate_as('storea@boonbaby.test');
select is(
  (select array_agg(table_name order by table_name) from tests.visible_rows_of_tenant(tests.id('tinytots')) where visible > 0),
  null,
  'STORE_STAFF sees zero rows of another tenant in every table'
);

-- ---------------------------------------------------------------------------
-- Writes across tenants are rejected or affect nothing.
-- ---------------------------------------------------------------------------
select tests.authenticate_as('owner@boonbaby.test');

select throws_ok(
  $$ insert into public.products (tenant_id, name, category, sku, barcode)
     values (tests.id('tinytots'), 'Planted', 'CLOTHING', 'X-1', 'X1') $$,
  '42501', null,
  'OWNER cannot insert a product into another tenant'
);

select throws_ok(
  $$ insert into public.suppliers (tenant_id, name) values (tests.id('tinytots'), 'Planted supplier') $$,
  '42501', null,
  'OWNER cannot insert a supplier into another tenant'
);

-- UPDATEs filtered by RLS silently match no rows; verify nothing changed afterwards as the superuser.
update public.products set name = 'Hijacked' where tenant_id = tests.id('tinytots');
update public.product_costs set cost_price = 0 where tenant_id = tests.id('tinytots');
update public.tenants set name = 'Hijacked' where id = tests.id('tinytots');

-- Moving products to another tenant is neutralised (tenant_id is pinned by trigger; RLS check is the backstop).
update public.products set tenant_id = tests.id('tinytots') where tenant_id = tests.id('boonbaby');
select is((select count(*) from public.products where tenant_id = tests.id('tinytots')), 0::bigint,
  'OWNER cannot move their own products into another tenant');

select tests.clear_authentication();
select is((select count(*) from public.products where name = 'Hijacked'), 0::bigint,
  'cross-tenant product update changed nothing');
select is((select count(*) from public.product_costs where tenant_id = tests.id('tinytots') and cost_price = 0), 0::bigint,
  'cross-tenant cost update changed nothing');
select is((select name from public.tenants where id = tests.id('tinytots')), 'Tiny Tots Boutique',
  'cross-tenant tenant update changed nothing');

-- ---------------------------------------------------------------------------
-- Anonymous visitors see nothing but public shop info.
-- ---------------------------------------------------------------------------
select tests.authenticate_as_anon();
select throws_ok($$ select count(*) from public.products $$, '42501', null, 'anon cannot read products');
select is((select name from public.tenant_public_info('boonbaby')), 'BoonBaby Kids',
  'anon can look up a shop name by slug');

select * from finish();
rollback;
