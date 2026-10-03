-- Phase 8: dashboard figures and the notification bell. SECURITY INVOKER: RLS scopes everything to the caller.

-- Per visible location: products in stock, total pieces, low-stock and out-of-stock counts.
create function public.location_summary()
returns table (location_id uuid, name text, kind public.location_kind, products_in_stock bigint, pieces bigint,
               low_stock bigint, out_of_stock bigint)
language sql stable security invoker set search_path = ''
as $$
  select l.id, l.name, l.kind,
         count(*) filter (where coalesce(sl.quantity, 0) > 0),
         coalesce(sum(sl.quantity), 0),
         count(*) filter (where p.reorder_level > 0 and coalesce(sl.quantity, 0) > 0 and sl.quantity <= p.reorder_level),
         count(*) filter (where coalesce(sl.quantity, 0) = 0)
  from public.locations l
  cross join public.products p
  left join public.stock_levels sl on sl.location_id = l.id and sl.product_id = p.id
  where l.tenant_id = (select app.current_tenant_id())
    and p.tenant_id = l.tenant_id
    and p.active
    and l.active
    and l.id = any ((select app.visible_location_ids())::uuid[])
  group by l.id, l.name, l.kind
  order by l.kind desc, l.name
$$;

-- Counts for the notification bell, scoped by role.
create function public.notification_summary()
returns jsonb
language plpgsql stable security invoker set search_path = ''
as $$
declare
  v_role public.app_role := app.current_app_role();
  v_locations uuid[] := app.visible_location_ids();
  v_room uuid;
begin
  if v_role is null then
    return '{}'::jsonb;
  end if;
  if v_role = 'STORE_STAFF' then
    return jsonb_build_object(
      'low_stock', (select count(*) from public.stock_levels sl join public.products p on p.id = sl.product_id
                    where sl.location_id = any (v_locations) and p.active and p.reorder_level > 0
                      and sl.quantity <= p.reorder_level),
      'incoming', (select count(*) from public.dispatches where status = 'DISPATCHED' and to_location_id = any (v_locations)),
      'suggestions', (select count(*) from public.restock_requests where status = 'WAITING_STAFF_APPROVAL'
                      and location_id = any (v_locations)));
  end if;
  select id into v_room from public.locations where kind = 'STORE_ROOM' and tenant_id = app.current_tenant_id();
  return jsonb_build_object(
    'low_stock', (select count(*) from public.stock_levels sl join public.products p on p.id = sl.product_id
                  where sl.location_id = v_room and p.active and p.reorder_level > 0 and sl.quantity <= p.reorder_level),
    'requests', (select count(*) from public.restock_requests where status = 'SENT'),
    'returns', (select count(*) from public.return_damage_entries where status = 'PENDING'),
    'discrepancies', (select count(*) from public.dispatches where status = 'RECEIVED_WITH_ISSUES'));
end;
$$;

revoke execute on function public.location_summary() from public, anon;
grant execute on function public.location_summary() to authenticated;
revoke execute on function public.notification_summary() from public, anon;
grant execute on function public.notification_summary() to authenticated;
