-- BoonBaby Store Manager — foundation schema
-- Every business table carries tenant_id. Security (helpers, RLS, grants) lives in the next migration.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- Private schema for helper functions and internal stock primitives. It is NOT exposed via the Data API.
create schema if not exists app;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('OWNER', 'STOREROOM_MANAGER', 'STORE_STAFF');
create type public.location_kind as enum ('STORE_ROOM', 'STORE');
create type public.product_category as enum ('CLOTHING', 'ACCESSORY');
create type public.movement_type as enum (
  'RECEIPT', 'DISPATCH_OUT', 'DISPATCH_IN', 'SALE', 'RETURN_OUT', 'RETURN_IN',
  'DAMAGE', 'SUPPLIER_RETURN', 'ADJUSTMENT'
);
create type public.tenant_status as enum ('trial', 'active', 'past_due', 'canceled');
create type public.dispatch_status as enum ('DRAFT', 'DISPATCHED', 'RECEIVED', 'RECEIVED_WITH_ISSUES', 'RESOLVED');
create type public.discrepancy_resolution as enum ('RETURN_TO_STOCK', 'WRITE_OFF');
create type public.restock_source as enum ('MANUAL', 'SUGGESTED');
create type public.restock_status as enum (
  'DRAFT', 'WAITING_STAFF_APPROVAL', 'SENT', 'APPROVED', 'REJECTED', 'DISPATCHED'
);
create type public.restock_line_status as enum ('PENDING', 'APPROVED', 'SKIPPED');
create type public.return_damage_type as enum ('RETURN_TO_STOREROOM', 'DAMAGE', 'SUPPLIER_RETURN');
create type public.approval_status as enum ('PENDING', 'APPROVED', 'REJECTED');

-- ---------------------------------------------------------------------------
-- Tenancy and people
-- ---------------------------------------------------------------------------
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$'
           and slug not in ('www', 'app', 'api', 'admin', 'auth', 'mail', 'static')),
  name text not null check (length(trim(name)) between 1 and 120),
  status public.tenant_status not null default 'trial',
  plan text not null default 'starter',
  trial_ends_at timestamptz not null default (now() + interval '14 days'),
  legal_name text,
  address text,
  phone text,
  email text,
  tax_id text,
  timezone text not null default 'Asia/Kolkata',
  currency text not null default 'INR',
  created_at timestamptz not null default now()
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  kind public.location_kind not null,
  name text not null check (length(trim(name)) between 1 and 80),
  address text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, name),
  unique (tenant_id, id) -- lets child tables use composite FKs that pin rows to one tenant
);
-- Exactly one Store Room per tenant.
create unique index locations_one_store_room on public.locations (tenant_id) where kind = 'STORE_ROOM';

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  role public.app_role not null,
  full_name text not null check (length(trim(full_name)) between 1 and 120),
  email text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index profiles_tenant_id_idx on public.profiles (tenant_id);

create table public.profile_locations (
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  location_id uuid not null,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  primary key (user_id, location_id),
  foreign key (tenant_id, location_id) references public.locations (tenant_id, id) on delete cascade
);
create index profile_locations_tenant_id_idx on public.profile_locations (tenant_id);
create index profile_locations_location_id_idx on public.profile_locations (location_id);

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  phone text,
  email text,
  address text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, name),
  unique (tenant_id, id)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 160),
  category public.product_category not null,
  sku text not null check (sku ~ '^[A-Za-z0-9._/-]{1,40}$'),
  -- Code 128 can encode printable ASCII; keep it short enough to scan reliably on a label.
  barcode text not null check (barcode ~ '^[!-~]{1,32}$'),
  selling_price numeric(12, 2) not null default 0 check (selling_price >= 0),
  supplier_id uuid,
  reorder_level integer not null default 0 check (reorder_level >= 0),
  image_path text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, sku),
  unique (tenant_id, barcode),
  unique (tenant_id, id),
  foreign key (tenant_id, supplier_id) references public.suppliers (tenant_id, id)
);
create index products_name_trgm_idx on public.products using gin (name extensions.gin_trgm_ops);
create index products_sku_trgm_idx on public.products using gin (sku extensions.gin_trgm_ops);
create index products_tenant_category_idx on public.products (tenant_id, category);
create index products_supplier_idx on public.products (supplier_id);

-- Cost price is deliberately separate so STORE_STAFF can never select it through any query.
create table public.product_costs (
  product_id uuid primary key,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  cost_price numeric(12, 2) not null check (cost_price >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),
  foreign key (tenant_id, product_id) references public.products (tenant_id, id) on delete cascade
);
create index product_costs_tenant_id_idx on public.product_costs (tenant_id);

-- ---------------------------------------------------------------------------
-- Stock (changed only by app.apply_stock_movement)
-- ---------------------------------------------------------------------------
create table public.stock_levels (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  location_id uuid not null,
  product_id uuid not null,
  quantity integer not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  primary key (location_id, product_id),
  foreign key (tenant_id, location_id) references public.locations (tenant_id, id),
  foreign key (tenant_id, product_id) references public.products (tenant_id, id)
);
create index stock_levels_tenant_id_idx on public.stock_levels (tenant_id);
create index stock_levels_product_idx on public.stock_levels (product_id);

create table public.stock_movements (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  product_id uuid not null,
  location_id uuid not null,
  type public.movement_type not null,
  quantity_delta integer not null check (quantity_delta <> 0),
  quantity_after integer not null check (quantity_after >= 0),
  ref_type text,
  ref_id uuid,
  user_id uuid references auth.users (id),
  note text,
  created_at timestamptz not null default now(),
  foreign key (tenant_id, location_id) references public.locations (tenant_id, id),
  foreign key (tenant_id, product_id) references public.products (tenant_id, id)
);
create index stock_movements_tenant_created_idx on public.stock_movements (tenant_id, created_at desc);
create index stock_movements_product_location_created_idx
  on public.stock_movements (product_id, location_id, created_at);
create index stock_movements_location_created_idx on public.stock_movements (location_id, created_at desc);
create index stock_movements_ref_idx on public.stock_movements (ref_type, ref_id);

-- ---------------------------------------------------------------------------
-- Documents
-- ---------------------------------------------------------------------------
create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  number text not null,
  location_id uuid not null,
  supplier_id uuid,
  invoice_number text not null check (length(trim(invoice_number)) between 1 and 60),
  note text,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  unique (tenant_id, number),
  unique (tenant_id, id),
  foreign key (tenant_id, location_id) references public.locations (tenant_id, id),
  foreign key (tenant_id, supplier_id) references public.suppliers (tenant_id, id)
);
create index receipts_tenant_created_idx on public.receipts (tenant_id, created_at desc);

create table public.receipt_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  receipt_id uuid not null,
  product_id uuid not null,
  quantity integer not null check (quantity > 0),
  unit_cost numeric(12, 2) check (unit_cost >= 0),
  foreign key (tenant_id, receipt_id) references public.receipts (tenant_id, id) on delete cascade,
  foreign key (tenant_id, product_id) references public.products (tenant_id, id)
);
create index receipt_lines_tenant_id_idx on public.receipt_lines (tenant_id);
create index receipt_lines_receipt_idx on public.receipt_lines (receipt_id);
create index receipt_lines_product_idx on public.receipt_lines (product_id);

create table public.restock_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  number text not null,
  location_id uuid not null,
  source public.restock_source not null,
  status public.restock_status not null,
  note text,
  created_by uuid references auth.users (id), -- null when created by the nightly suggestion job
  submitted_at timestamptz,
  submitted_by uuid references auth.users (id),
  decided_at timestamptz,
  decided_by uuid references auth.users (id),
  decision_note text,
  created_at timestamptz not null default now(),
  unique (tenant_id, number),
  unique (tenant_id, id),
  foreign key (tenant_id, location_id) references public.locations (tenant_id, id)
);
create index restock_requests_tenant_status_idx on public.restock_requests (tenant_id, status);
create index restock_requests_location_idx on public.restock_requests (location_id);

create table public.restock_request_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  request_id uuid not null,
  product_id uuid not null,
  quantity integer not null check (quantity > 0),
  suggested_quantity integer check (suggested_quantity > 0),
  line_status public.restock_line_status not null default 'PENDING',
  unique (request_id, product_id),
  foreign key (tenant_id, request_id) references public.restock_requests (tenant_id, id) on delete cascade,
  foreign key (tenant_id, product_id) references public.products (tenant_id, id)
);
create index restock_request_lines_tenant_id_idx on public.restock_request_lines (tenant_id);
create index restock_request_lines_product_idx on public.restock_request_lines (product_id);

create table public.dispatches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  number text not null,
  from_location_id uuid not null,
  to_location_id uuid not null,
  status public.dispatch_status not null default 'DRAFT',
  restock_request_id uuid,
  note text,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  dispatched_at timestamptz,
  dispatched_by uuid references auth.users (id),
  received_at timestamptz,
  received_by uuid references auth.users (id),
  check (from_location_id <> to_location_id),
  unique (tenant_id, number),
  unique (tenant_id, id),
  foreign key (tenant_id, from_location_id) references public.locations (tenant_id, id),
  foreign key (tenant_id, to_location_id) references public.locations (tenant_id, id),
  foreign key (tenant_id, restock_request_id) references public.restock_requests (tenant_id, id)
);
create index dispatches_tenant_status_idx on public.dispatches (tenant_id, status);
create index dispatches_to_location_idx on public.dispatches (to_location_id, status);
create index dispatches_restock_request_idx on public.dispatches (restock_request_id);

create table public.dispatch_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  dispatch_id uuid not null,
  product_id uuid not null,
  quantity_sent integer not null check (quantity_sent > 0),
  quantity_received integer check (quantity_received >= 0),
  quantity_missing integer not null default 0 check (quantity_missing >= 0),
  quantity_damaged integer not null default 0 check (quantity_damaged >= 0),
  issue_note text,
  resolution public.discrepancy_resolution,
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id),
  unique (dispatch_id, product_id),
  check (quantity_received is null
         or quantity_received + quantity_missing + quantity_damaged = quantity_sent),
  foreign key (tenant_id, dispatch_id) references public.dispatches (tenant_id, id) on delete cascade,
  foreign key (tenant_id, product_id) references public.products (tenant_id, id)
);
create index dispatch_lines_tenant_id_idx on public.dispatch_lines (tenant_id);
create index dispatch_lines_product_idx on public.dispatch_lines (product_id);

create table public.return_damage_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  number text not null,
  location_id uuid not null,
  type public.return_damage_type not null,
  product_id uuid not null,
  quantity integer not null check (quantity > 0),
  reason text not null check (length(trim(reason)) between 1 and 500),
  status public.approval_status not null default 'PENDING',
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  decided_by uuid references auth.users (id),
  decided_at timestamptz,
  decision_note text,
  unique (tenant_id, number),
  foreign key (tenant_id, location_id) references public.locations (tenant_id, id),
  foreign key (tenant_id, product_id) references public.products (tenant_id, id)
);
create index return_damage_entries_tenant_status_idx on public.return_damage_entries (tenant_id, status);
create index return_damage_entries_location_idx on public.return_damage_entries (location_id);
create index return_damage_entries_product_idx on public.return_damage_entries (product_id);

create table public.label_print_log (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id),
  preset smallint not null check (preset in (24, 40, 65)),
  label_count integer not null check (label_count > 0),
  product_count integer not null check (product_count > 0),
  source text not null check (source in ('PRODUCTS', 'RECEIPT')),
  receipt_id uuid,
  created_at timestamptz not null default now()
);
create index label_print_log_tenant_created_idx on public.label_print_log (tenant_id, created_at desc);

create table public.audit_log (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid references auth.users (id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_tenant_created_idx on public.audit_log (tenant_id, created_at desc);
create index audit_log_entity_idx on public.audit_log (entity_type, entity_id);

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  prefix text not null unique,
  key_hash text not null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index api_keys_tenant_id_idx on public.api_keys (tenant_id);

-- ---------------------------------------------------------------------------
-- Internal bookkeeping (never readable by clients)
-- ---------------------------------------------------------------------------
create table public.tenant_counters (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  value bigint not null default 0,
  primary key (tenant_id, name)
);

create table public.idempotency_keys (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  key uuid not null,
  fn text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, key)
);
create index idempotency_keys_created_idx on public.idempotency_keys (created_at);
