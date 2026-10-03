-- BoonBaby Store Manager — local demo seed (never runs in production).
-- Two tenants so isolation can be seen and tested. Every demo login uses the password: 123
--
--   boonbaby.localhost:3000   owner@boonbaby.test, storeroom@boonbaby.test, storea@boonbaby.test, storeb@boonbaby.test
--   tinytots.localhost:3000   owner@tinytots.test, storeroom@tinytots.test, storea@tinytots.test, storeb@tinytots.test
--
-- IDs are fixed so database tests can refer to them:
--   tenant      X0000000-0000-4000-8000-000000000000      (X = 1 boonbaby, 2 tinytots)
--   locations   X0000000-0000-4000-8000-00000000001{0 store room, 1 store A, 2 store B}
--   users       X0000000-0000-4000-8000-00000000010{1 owner, 2 storeroom, 3 store A, 4 store B}

-- ---------------------------------------------------------------------------
-- Auth users
-- ---------------------------------------------------------------------------
create function pg_temp.seed_user(p_id uuid, p_email text)
returns void
language sql
as $$
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email,
    extensions.crypt('123', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
  );
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), p_id, p_id::text,
          jsonb_build_object('sub', p_id::text, 'email', p_email, 'email_verified', true),
          'email', now(), now(), now());
$$;

select pg_temp.seed_user('10000000-0000-4000-8000-000000000101', 'owner@boonbaby.test');
select pg_temp.seed_user('10000000-0000-4000-8000-000000000102', 'storeroom@boonbaby.test');
select pg_temp.seed_user('10000000-0000-4000-8000-000000000103', 'storea@boonbaby.test');
select pg_temp.seed_user('10000000-0000-4000-8000-000000000104', 'storeb@boonbaby.test');
select pg_temp.seed_user('20000000-0000-4000-8000-000000000101', 'owner@tinytots.test');
select pg_temp.seed_user('20000000-0000-4000-8000-000000000102', 'storeroom@tinytots.test');
select pg_temp.seed_user('20000000-0000-4000-8000-000000000103', 'storea@tinytots.test');
select pg_temp.seed_user('20000000-0000-4000-8000-000000000104', 'storeb@tinytots.test');

-- ---------------------------------------------------------------------------
-- Tenants, locations, profiles
-- ---------------------------------------------------------------------------
insert into public.tenants (id, slug, name, status, plan, legal_name, address, phone, email) values
  ('10000000-0000-4000-8000-000000000000', 'boonbaby', 'BoonBaby Kids', 'active', 'standard',
   'BoonBaby Kids Pvt Ltd', '12 MG Road, Kochi, Kerala 682016', '+91 98470 00000', 'owner@boonbaby.test'),
  ('20000000-0000-4000-8000-000000000000', 'tinytots', 'Tiny Tots Boutique', 'active', 'starter',
   'Tiny Tots Boutique', '4 Park Street, Kolkata 700016', '+91 98300 00000', 'owner@tinytots.test');

insert into public.locations (id, tenant_id, kind, name, address) values
  ('10000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000000', 'STORE_ROOM', 'Store Room', 'Warehouse, Edappally'),
  ('10000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000000', 'STORE', 'Store A — MG Road', 'MG Road'),
  ('10000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000000', 'STORE', 'Store B — Lulu Mall', 'Lulu Mall'),
  ('20000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000000', 'STORE_ROOM', 'Store Room', null),
  ('20000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000000', 'STORE', 'Store A', null),
  ('20000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000000', 'STORE', 'Store B', null);

insert into public.profiles (user_id, tenant_id, role, full_name, email) values
  ('10000000-0000-4000-8000-000000000101', '10000000-0000-4000-8000-000000000000', 'OWNER', 'Anita Owner', 'owner@boonbaby.test'),
  ('10000000-0000-4000-8000-000000000102', '10000000-0000-4000-8000-000000000000', 'STOREROOM_MANAGER', 'Ravi Storeroom', 'storeroom@boonbaby.test'),
  ('10000000-0000-4000-8000-000000000103', '10000000-0000-4000-8000-000000000000', 'STORE_STAFF', 'Meera Store A', 'storea@boonbaby.test'),
  ('10000000-0000-4000-8000-000000000104', '10000000-0000-4000-8000-000000000000', 'STORE_STAFF', 'Joseph Store B', 'storeb@boonbaby.test'),
  ('20000000-0000-4000-8000-000000000101', '20000000-0000-4000-8000-000000000000', 'OWNER', 'Tara Owner', 'owner@tinytots.test'),
  ('20000000-0000-4000-8000-000000000102', '20000000-0000-4000-8000-000000000000', 'STOREROOM_MANAGER', 'Sunil Storeroom', 'storeroom@tinytots.test'),
  ('20000000-0000-4000-8000-000000000103', '20000000-0000-4000-8000-000000000000', 'STORE_STAFF', 'Priya Store A', 'storea@tinytots.test'),
  ('20000000-0000-4000-8000-000000000104', '20000000-0000-4000-8000-000000000000', 'STORE_STAFF', 'Arjun Store B', 'storeb@tinytots.test');

insert into public.profile_locations (user_id, location_id, tenant_id) values
  ('10000000-0000-4000-8000-000000000102', '10000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000000'),
  ('10000000-0000-4000-8000-000000000103', '10000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000000'),
  ('10000000-0000-4000-8000-000000000104', '10000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000000'),
  ('20000000-0000-4000-8000-000000000102', '20000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000000'),
  ('20000000-0000-4000-8000-000000000103', '20000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000000'),
  ('20000000-0000-4000-8000-000000000104', '20000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000000');

-- ---------------------------------------------------------------------------
-- Suppliers and products
-- ---------------------------------------------------------------------------
insert into public.suppliers (id, tenant_id, name, phone, email) values
  ('10000000-0000-4000-8000-000000000201', '10000000-0000-4000-8000-000000000000', 'Little Threads Garments', '+91 90000 11111', 'sales@littlethreads.test'),
  ('10000000-0000-4000-8000-000000000202', '10000000-0000-4000-8000-000000000000', 'Cuddle Co. Accessories', '+91 90000 22222', 'orders@cuddleco.test'),
  ('10000000-0000-4000-8000-000000000203', '10000000-0000-4000-8000-000000000000', 'Sunny Cotton Mills', '+91 90000 33333', null),
  ('20000000-0000-4000-8000-000000000201', '20000000-0000-4000-8000-000000000000', 'Kolkata Kids Wholesale', null, null);

-- boonbaby catalogue: (name, category, selling price, cost, reorder level, supplier #, store room qty, store A qty, store B qty)
create temporary table seed_catalogue (
  n serial, name text, category public.product_category, price numeric, cost numeric, reorder integer,
  supplier integer, qty_room integer, qty_a integer, qty_b integer
);
insert into seed_catalogue (name, category, price, cost, reorder, supplier, qty_room, qty_a, qty_b) values
  ('Organic Cotton Romper — Mint', 'CLOTHING', 649, 310, 6, 1, 60, 12, 4),
  ('Organic Cotton Romper — Peach', 'CLOTHING', 649, 310, 6, 1, 48, 3, 10),
  ('Muslin Swaddle Set (3 pcs)', 'ACCESSORY', 999, 520, 4, 2, 30, 8, 2),
  ('Ribbed Bodysuit — White', 'CLOTHING', 449, 190, 8, 3, 90, 20, 15),
  ('Ribbed Bodysuit — Grey', 'CLOTHING', 449, 190, 8, 3, 72, 6, 9),
  ('Knitted Booties — Lavender', 'ACCESSORY', 399, 150, 5, 2, 40, 5, 0),
  ('Knitted Cap — Powder Blue', 'ACCESSORY', 299, 110, 5, 2, 45, 9, 7),
  ('Cotton Mittens (2 pairs)', 'ACCESSORY', 249, 90, 6, 2, 55, 14, 3),
  ('Hooded Towel — Bunny', 'ACCESSORY', 799, 380, 3, 2, 22, 4, 4),
  ('Sleep Suit with Feet — Stars', 'CLOTHING', 899, 430, 4, 1, 35, 2, 6),
  ('Frock with Bloomers — Floral', 'CLOTHING', 1099, 520, 3, 1, 28, 5, 1),
  ('Dungaree Set — Denim', 'CLOTHING', 1299, 640, 3, 1, 18, 3, 3),
  ('Kurta Pyjama — Festive Cream', 'CLOTHING', 1499, 720, 2, 3, 15, 2, 2),
  ('Jhabla Set (5 pcs)', 'CLOTHING', 699, 300, 6, 3, 64, 10, 12),
  ('Bib Set — Animals (3 pcs)', 'ACCESSORY', 349, 140, 6, 2, 50, 7, 11),
  ('Soft Rattle — Elephant', 'ACCESSORY', 449, 200, 4, 2, 26, 6, 1),
  ('Baby Blanket — Cellular Knit', 'ACCESSORY', 1199, 590, 3, 2, 20, 3, 2),
  ('Shorts & Tee Set — Sailor', 'CLOTHING', 799, 360, 4, 1, 32, 4, 5),
  ('Winter Jacket — Quilted Navy', 'CLOTHING', 1799, 900, 2, 1, 12, 1, 2),
  ('Socks Pack (6 pairs)', 'ACCESSORY', 399, 160, 8, 3, 80, 16, 4);

do $$
declare
  v_tenant uuid := '10000000-0000-4000-8000-000000000000';
  v_room uuid := '10000000-0000-4000-8000-000000000010';
  v_a uuid := '10000000-0000-4000-8000-000000000011';
  v_b uuid := '10000000-0000-4000-8000-000000000012';
  r record;
  v_product uuid;
begin
  for r in select * from seed_catalogue order by n loop
    insert into public.products (tenant_id, name, category, sku, barcode, selling_price, supplier_id, reorder_level)
    values (
      v_tenant, r.name, r.category,
      (case r.category when 'CLOTHING' then 'CLO-' else 'ACC-' end)
        || lpad(app.next_counter(v_tenant, 'sku:' || r.category)::text, 5, '0'),
      'BB' || lpad(app.next_counter(v_tenant, 'barcode')::text, 10, '0'),
      r.price,
      ('10000000-0000-4000-8000-00000000020' || r.supplier)::uuid,
      r.reorder
    )
    returning id into v_product;

    insert into public.product_costs (product_id, tenant_id, cost_price) values (v_product, v_tenant, r.cost);

    perform app.apply_stock_movement(v_tenant, v_product, v_room, 'ADJUSTMENT', r.qty_room, 'seed', null, 'Opening stock (demo data)');
    if r.qty_a > 0 then
      perform app.apply_stock_movement(v_tenant, v_product, v_a, 'ADJUSTMENT', r.qty_a, 'seed', null, 'Opening stock (demo data)');
    end if;
    if r.qty_b > 0 then
      perform app.apply_stock_movement(v_tenant, v_product, v_b, 'ADJUSTMENT', r.qty_b, 'seed', null, 'Opening stock (demo data)');
    end if;
  end loop;
end;
$$;

-- tinytots: a small catalogue so cross-tenant tests have something to (fail to) read.
do $$
declare
  v_tenant uuid := '20000000-0000-4000-8000-000000000000';
  v_product uuid;
  v_name text;
begin
  foreach v_name in array array['Tiny Tots Onesie — Yellow', 'Tiny Tots Bib — Polka', 'Tiny Tots Beanie — Red'] loop
    insert into public.products (tenant_id, name, category, sku, barcode, selling_price, supplier_id, reorder_level)
    values (
      v_tenant, v_name, case when v_name like '%Onesie%' then 'CLOTHING' else 'ACCESSORY' end::public.product_category,
      'TT-' || lpad(app.next_counter(v_tenant, 'sku:manual')::text, 5, '0'),
      'BB' || lpad(app.next_counter(v_tenant, 'barcode')::text, 10, '0'),
      499, '20000000-0000-4000-8000-000000000201', 4
    )
    returning id into v_product;
    insert into public.product_costs (product_id, tenant_id, cost_price) values (v_product, v_tenant, 210);
    perform app.apply_stock_movement(v_tenant, v_product, '20000000-0000-4000-8000-000000000010', 'ADJUSTMENT', 25, 'seed', null, 'Opening stock (demo data)');
    perform app.apply_stock_movement(v_tenant, v_product, '20000000-0000-4000-8000-000000000011', 'ADJUSTMENT', 5, 'seed', null, 'Opening stock (demo data)');
    perform app.apply_stock_movement(v_tenant, v_product, '20000000-0000-4000-8000-000000000012', 'ADJUSTMENT', 5, 'seed', null, 'Opening stock (demo data)');
  end loop;
end;
$$;

drop table seed_catalogue;
