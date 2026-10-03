-- Phase 8: reports. SECURITY INVOKER — RLS decides what the caller sees. Date ranges are inclusive calendar days
-- in India time (tenant timezone default). Each returns one page plus total_count for server-side pagination.

create function app.day_start(p_day date)
returns timestamptz
language sql immutable
as $$ select (p_day::timestamp at time zone 'Asia/Kolkata') $$;

create function public.report_stock(
  p_location_id uuid default null,
  p_low_only boolean default false,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (product text, sku text, barcode text, category text, location text, quantity integer, reorder_level integer,
               selling_price numeric, status text, total_count bigint)
language sql stable security invoker set search_path = ''
as $$
  select p.name, p.sku, p.barcode, initcap(p.category::text), l.name, coalesce(sl.quantity, 0), p.reorder_level,
         p.selling_price,
         case when coalesce(sl.quantity, 0) = 0 then 'Out of stock'
              when p.reorder_level > 0 and sl.quantity <= p.reorder_level then 'Low'
              else 'In stock' end,
         count(*) over ()
  from public.products p
  join public.locations l on l.tenant_id = p.tenant_id and l.active
  left join public.stock_levels sl on sl.product_id = p.id and sl.location_id = l.id
  where p.tenant_id = (select app.current_tenant_id())
    and p.active
    and l.id = any ((select app.visible_location_ids())::uuid[])
    and (p_location_id is null or l.id = p_location_id)
    and (not p_low_only or (p.reorder_level > 0 and coalesce(sl.quantity, 0) <= p.reorder_level))
  order by l.kind desc, l.name, p.name
  limit least(greatest(p_limit, 1), 10000) offset greatest(p_offset, 0)
$$;

create function public.report_dispatches(
  p_from date,
  p_to date,
  p_location_id uuid default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (number text, store text, status text, dispatched_at timestamptz, received_at timestamptz, lines bigint,
               sent bigint, received bigint, missing bigint, damaged bigint, total_count bigint)
language sql stable security invoker set search_path = ''
as $$
  select d.number, l.name, d.status::text, d.dispatched_at, d.received_at, count(dl.id),
         coalesce(sum(dl.quantity_sent), 0), coalesce(sum(dl.quantity_received), 0),
         coalesce(sum(dl.quantity_missing), 0), coalesce(sum(dl.quantity_damaged), 0), count(*) over ()
  from public.dispatches d
  join public.locations l on l.id = d.to_location_id
  left join public.dispatch_lines dl on dl.dispatch_id = d.id
  where d.status <> 'DRAFT'
    and d.dispatched_at >= app.day_start(p_from) and d.dispatched_at < app.day_start(p_to + 1)
    and (p_location_id is null or d.to_location_id = p_location_id)
  group by d.id, l.name
  order by d.dispatched_at desc
  limit least(greatest(p_limit, 1), 10000) offset greatest(p_offset, 0)
$$;

create function public.report_returns(
  p_from date,
  p_to date,
  p_location_id uuid default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (happened_at timestamptz, reference text, location text, kind text, product text, sku text, quantity integer,
               outcome text, reason text, total_count bigint)
language sql stable security invoker set search_path = ''
as $$
  with rows as (
    select e.created_at as happened_at, e.number as reference, l.name as location,
           case e.type when 'RETURN_TO_STOREROOM' then 'Return to Store Room' when 'DAMAGE' then 'Damaged'
                       else 'Return to supplier' end as kind,
           p.name as product, p.sku, e.quantity, initcap(e.status::text) as outcome, e.reason
    from public.return_damage_entries e
    join public.locations l on l.id = e.location_id
    join public.products p on p.id = e.product_id
    where e.created_at >= app.day_start(p_from) and e.created_at < app.day_start(p_to + 1)
      and (p_location_id is null or e.location_id = p_location_id)
    union all
    select d.received_at, d.number, l.name,
           case when dl.quantity_missing > 0 and dl.quantity_damaged > 0 then 'Delivery: missing & damaged'
                when dl.quantity_missing > 0 then 'Delivery: missing' else 'Delivery: damaged' end,
           p.name, p.sku, dl.quantity_missing + dl.quantity_damaged,
           case dl.resolution when 'WRITE_OFF' then 'Written off' when 'RETURN_TO_STOCK' then 'Returned to stock'
                              else 'Open' end,
           coalesce(dl.issue_note, '')
    from public.dispatch_lines dl
    join public.dispatches d on d.id = dl.dispatch_id
    join public.locations l on l.id = d.to_location_id
    join public.products p on p.id = dl.product_id
    where dl.quantity_missing + dl.quantity_damaged > 0
      and d.received_at >= app.day_start(p_from) and d.received_at < app.day_start(p_to + 1)
      and (p_location_id is null or d.to_location_id = p_location_id)
  )
  select *, count(*) over () from rows
  order by happened_at desc
  limit least(greatest(p_limit, 1), 10000) offset greatest(p_offset, 0)
$$;

create function public.report_movements(
  p_from date,
  p_to date,
  p_location_id uuid default null,
  p_type public.movement_type default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (happened_at timestamptz, location text, product text, sku text, type text, quantity_delta integer,
               quantity_after integer, by_user text, note text, total_count bigint)
language sql stable security invoker set search_path = ''
as $$
  select m.created_at, l.name, p.name, p.sku, m.type::text, m.quantity_delta, m.quantity_after,
         coalesce(pr.full_name, case when m.ref_type = 'sale' then 'Sales API' else '' end), coalesce(m.note, ''),
         count(*) over ()
  from public.stock_movements m
  join public.locations l on l.id = m.location_id
  join public.products p on p.id = m.product_id
  left join public.profiles pr on pr.user_id = m.user_id
  where m.created_at >= app.day_start(p_from) and m.created_at < app.day_start(p_to + 1)
    and (p_location_id is null or m.location_id = p_location_id)
    and (p_type is null or m.type = p_type)
  order by m.created_at desc, m.id desc
  limit least(greatest(p_limit, 1), 10000) offset greatest(p_offset, 0)
$$;

revoke execute on function app.day_start(date) from public, anon;
grant execute on function app.day_start(date) to authenticated;
revoke execute on function public.report_stock(uuid, boolean, integer, integer) from public, anon;
grant execute on function public.report_stock(uuid, boolean, integer, integer) to authenticated;
revoke execute on function public.report_dispatches(date, date, uuid, integer, integer) from public, anon;
grant execute on function public.report_dispatches(date, date, uuid, integer, integer) to authenticated;
revoke execute on function public.report_returns(date, date, uuid, integer, integer) from public, anon;
grant execute on function public.report_returns(date, date, uuid, integer, integer) to authenticated;
revoke execute on function public.report_movements(date, date, uuid, public.movement_type, integer, integer) from public, anon;
grant execute on function public.report_movements(date, date, uuid, public.movement_type, integer, integer) to authenticated;
