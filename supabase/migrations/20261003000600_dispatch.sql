-- Phase 4: dispatches from the Store Room to stores, store receipt with missing/damaged flags, discrepancies.

-- Create or replace a DRAFT dispatch. p_lines: [{product_id, quantity}]. Stock is not touched until sent.
create function public.save_dispatch_draft(
  p_id uuid,
  p_to_location_id uuid,
  p_lines jsonb,
  p_note text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_profile public.profiles := app.require_user(array['OWNER', 'STOREROOM_MANAGER']::public.app_role[]);
  v_tenant uuid := v_profile.tenant_id;
  v_id uuid := p_id;
  v_status public.dispatch_status;
begin
  if not exists (select 1 from public.locations
                 where id = p_to_location_id and tenant_id = v_tenant and kind = 'STORE' and active) then
    perform app.raise('BB_LOCATION_NOT_FOUND', 'Choose the store to send to.');
  end if;

  if v_id is null then
    insert into public.dispatches (tenant_id, number, from_location_id, to_location_id, note, created_by)
    values (v_tenant, app.next_document_number(v_tenant, 'DSP'), app.store_room_id(v_tenant), p_to_location_id,
            nullif(trim(p_note), ''), v_profile.user_id)
    returning id into v_id;
    perform app.audit(v_tenant, 'dispatch.drafted', 'dispatch', v_id, '{}'::jsonb);
  else
    select status into v_status from public.dispatches where id = v_id and tenant_id = v_tenant for update;
    if v_status is null then
      perform app.raise('BB_NOT_FOUND', 'That dispatch was not found.');
    elsif v_status <> 'DRAFT' then
      perform app.raise('BB_NOT_DRAFT', 'This dispatch has already been sent and can''t be edited.');
    end if;
    update public.dispatches set to_location_id = p_to_location_id, note = nullif(trim(p_note), '') where id = v_id;
    delete from public.dispatch_lines where dispatch_id = v_id;
  end if;

  insert into public.dispatch_lines (tenant_id, dispatch_id, product_id, quantity_sent)
  select v_tenant, v_id, l.product_id, l.quantity from app.parse_lines(v_tenant, p_lines) l;

  return v_id;
end;
$$;

create function public.delete_dispatch_draft(p_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_profile public.profiles := app.require_user(array['OWNER', 'STOREROOM_MANAGER']::public.app_role[]);
  v_dispatch public.dispatches;
begin
  select * into v_dispatch from public.dispatches where id = p_id and tenant_id = v_profile.tenant_id for update;
  if v_dispatch.id is null then
    perform app.raise('BB_NOT_FOUND', 'That dispatch was not found.');
  elsif v_dispatch.status <> 'DRAFT' then
    perform app.raise('BB_NOT_DRAFT', 'Only drafts can be deleted.');
  end if;
  if v_dispatch.restock_request_id is not null then
    update public.restock_requests set status = 'SENT', decided_at = null, decided_by = null
    where id = v_dispatch.restock_request_id and status = 'APPROVED';
  end if;
  delete from public.dispatches where id = p_id;
  perform app.audit(v_profile.tenant_id, 'dispatch.draft_deleted', 'dispatch', p_id,
    jsonb_build_object('number', v_dispatch.number));
end;
$$;

-- DRAFT → DISPATCHED: deducts Store Room stock (DISPATCH_OUT). Goods are then in transit until the store confirms.
create function public.send_dispatch(p_id uuid, p_idempotency_key uuid default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_profile public.profiles := app.require_user(array['OWNER', 'STOREROOM_MANAGER']::public.app_role[]);
  v_tenant uuid := v_profile.tenant_id;
  v_prior jsonb;
  v_dispatch public.dispatches;
  v_line record;
  v_pieces integer := 0;
  v_store_name text;
begin
  v_prior := app.idempotency_begin(v_tenant, p_idempotency_key, 'send_dispatch');
  if v_prior is not null then
    return v_prior;
  end if;

  select * into v_dispatch from public.dispatches where id = p_id and tenant_id = v_tenant for update;
  if v_dispatch.id is null then
    perform app.raise('BB_NOT_FOUND', 'That dispatch was not found.');
  elsif v_dispatch.status <> 'DRAFT' then
    perform app.raise('BB_NOT_DRAFT', 'This dispatch has already been sent.');
  end if;
  if not exists (select 1 from public.dispatch_lines where dispatch_id = p_id) then
    perform app.raise('BB_NO_LINES', 'Add at least one product before sending.');
  end if;
  select name into v_store_name from public.locations where id = v_dispatch.to_location_id;

  -- Lock in product order so concurrent dispatches can't deadlock.
  for v_line in
    select product_id, quantity_sent from public.dispatch_lines where dispatch_id = p_id order by product_id
  loop
    perform app.apply_stock_movement(v_tenant, v_line.product_id, v_dispatch.from_location_id, 'DISPATCH_OUT',
      -v_line.quantity_sent, 'dispatch', p_id, v_dispatch.number || ' to ' || v_store_name);
    v_pieces := v_pieces + v_line.quantity_sent;
  end loop;

  update public.dispatches
  set status = 'DISPATCHED', dispatched_at = now(), dispatched_by = v_profile.user_id
  where id = p_id;
  if v_dispatch.restock_request_id is not null then
    update public.restock_requests set status = 'DISPATCHED' where id = v_dispatch.restock_request_id;
  end if;

  perform app.audit(v_tenant, 'dispatch.sent', 'dispatch', p_id,
    jsonb_build_object('number', v_dispatch.number, 'to', v_store_name, 'pieces', v_pieces));
  return app.idempotency_finish(v_tenant, p_idempotency_key, 'send_dispatch',
    jsonb_build_object('dispatch_id', p_id, 'number', v_dispatch.number, 'pieces', v_pieces));
end;
$$;

-- Store confirms a delivery. p_lines: [{line_id, received, missing, damaged, note?}] covering every line;
-- received + missing + damaged must equal what was sent. Good quantity is added to the store (DISPATCH_IN).
create function public.receive_dispatch(
  p_id uuid,
  p_lines jsonb,
  p_idempotency_key uuid default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_profile public.profiles := app.require_user(array['OWNER', 'STORE_STAFF']::public.app_role[]);
  v_tenant uuid := v_profile.tenant_id;
  v_prior jsonb;
  v_dispatch public.dispatches;
  v_line public.dispatch_lines;
  v_input jsonb;
  v_received integer; v_missing integer; v_damaged integer;
  v_issues boolean := false;
  v_status public.dispatch_status;
begin
  v_prior := app.idempotency_begin(v_tenant, p_idempotency_key, 'receive_dispatch');
  if v_prior is not null then
    return v_prior;
  end if;

  select * into v_dispatch from public.dispatches where id = p_id and tenant_id = v_tenant for update;
  if v_dispatch.id is null then
    perform app.raise('BB_NOT_FOUND', 'That dispatch was not found.');
  end if;
  perform app.assert_location_access(v_profile, v_dispatch.to_location_id);
  if v_dispatch.status <> 'DISPATCHED' then
    perform app.raise('BB_NOT_IN_TRANSIT', 'This delivery has already been confirmed.');
  end if;
  if jsonb_typeof(p_lines) <> 'array'
     or jsonb_array_length(p_lines) <> (select count(*) from public.dispatch_lines where dispatch_id = p_id) then
    perform app.raise('BB_LINES_MISMATCH', 'Confirm every line on the delivery.');
  end if;

  for v_line in select * from public.dispatch_lines where dispatch_id = p_id order by product_id loop
    select value into v_input from jsonb_array_elements(p_lines) where value ->> 'line_id' = v_line.id::text;
    if v_input is null then
      perform app.raise('BB_LINES_MISMATCH', 'Confirm every line on the delivery.');
    end if;
    begin
      v_received := (v_input ->> 'received')::integer;
      v_missing := coalesce((v_input ->> 'missing')::integer, 0);
      v_damaged := coalesce((v_input ->> 'damaged')::integer, 0);
    exception when others then
      perform app.raise('BB_INVALID_QUANTITY', 'Quantities must be whole numbers.');
    end;
    if v_received is null or v_received < 0 or v_missing < 0 or v_damaged < 0
       or v_received + v_missing + v_damaged <> v_line.quantity_sent then
      perform app.raise('BB_QUANTITY_MISMATCH',
        format('Received, missing, and damaged must add up to %s for each line.', v_line.quantity_sent));
    end if;
    if (v_missing > 0 or v_damaged > 0) and nullif(trim(v_input ->> 'note'), '') is null then
      perform app.raise('BB_NOTE_REQUIRED', 'Add a note explaining the missing or damaged pieces.');
    end if;

    update public.dispatch_lines
    set quantity_received = v_received, quantity_missing = v_missing, quantity_damaged = v_damaged,
        issue_note = nullif(trim(v_input ->> 'note'), '')
    where id = v_line.id;

    if v_received > 0 then
      perform app.apply_stock_movement(v_tenant, v_line.product_id, v_dispatch.to_location_id, 'DISPATCH_IN',
        v_received, 'dispatch', p_id, v_dispatch.number);
    end if;
    v_issues := v_issues or v_missing > 0 or v_damaged > 0;
  end loop;

  v_status := case when v_issues then 'RECEIVED_WITH_ISSUES'::public.dispatch_status else 'RECEIVED'::public.dispatch_status end;
  update public.dispatches set status = v_status, received_at = now(), received_by = v_profile.user_id where id = p_id;

  perform app.audit(v_tenant, 'dispatch.received', 'dispatch', p_id,
    jsonb_build_object('number', v_dispatch.number, 'status', v_status));
  return app.idempotency_finish(v_tenant, p_idempotency_key, 'receive_dispatch',
    jsonb_build_object('dispatch_id', p_id, 'status', v_status));
end;
$$;

-- Store Room settles a missing/damaged line: put the quantity back into Store Room stock, or write it off.
-- Write-off is recorded as RETURN_IN then DAMAGE at the Store Room so the ledger shows where the pieces went.
create function public.resolve_discrepancy(
  p_line_id uuid,
  p_resolution public.discrepancy_resolution,
  p_note text default null,
  p_idempotency_key uuid default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_profile public.profiles := app.require_user(array['OWNER', 'STOREROOM_MANAGER']::public.app_role[]);
  v_tenant uuid := v_profile.tenant_id;
  v_prior jsonb;
  v_line public.dispatch_lines;
  v_dispatch public.dispatches;
  v_qty integer;
  v_note text;
begin
  v_prior := app.idempotency_begin(v_tenant, p_idempotency_key, 'resolve_discrepancy');
  if v_prior is not null then
    return v_prior;
  end if;

  select * into v_line from public.dispatch_lines where id = p_line_id and tenant_id = v_tenant for update;
  if v_line.id is null then
    perform app.raise('BB_NOT_FOUND', 'That line was not found.');
  end if;
  select * into v_dispatch from public.dispatches where id = v_line.dispatch_id for update;
  v_qty := v_line.quantity_missing + v_line.quantity_damaged;
  if v_dispatch.status not in ('RECEIVED_WITH_ISSUES') or v_qty = 0 then
    perform app.raise('BB_NOTHING_TO_RESOLVE', 'This line has no open discrepancy.');
  end if;
  if v_line.resolution is not null then
    perform app.raise('BB_ALREADY_RESOLVED', 'This discrepancy has already been resolved.');
  end if;

  v_note := v_dispatch.number || ' discrepancy' || coalesce(' · ' || nullif(trim(p_note), ''), '');
  perform app.apply_stock_movement(v_tenant, v_line.product_id, v_dispatch.from_location_id, 'RETURN_IN', v_qty,
    'dispatch', v_dispatch.id, v_note);
  if p_resolution = 'WRITE_OFF' then
    perform app.apply_stock_movement(v_tenant, v_line.product_id, v_dispatch.from_location_id, 'DAMAGE', -v_qty,
      'dispatch', v_dispatch.id, v_note || ' · written off');
  end if;

  update public.dispatch_lines set resolution = p_resolution, resolved_at = now(), resolved_by = v_profile.user_id
  where id = p_line_id;

  if not exists (
    select 1 from public.dispatch_lines
    where dispatch_id = v_dispatch.id and quantity_missing + quantity_damaged > 0 and resolution is null
  ) then
    update public.dispatches set status = 'RESOLVED' where id = v_dispatch.id;
  end if;

  perform app.audit(v_tenant, 'dispatch.discrepancy_resolved', 'dispatch', v_dispatch.id,
    jsonb_build_object('line_id', p_line_id, 'resolution', p_resolution, 'quantity', v_qty));
  return app.idempotency_finish(v_tenant, p_idempotency_key, 'resolve_discrepancy',
    jsonb_build_object('dispatch_id', v_dispatch.id, 'resolution', p_resolution, 'quantity', v_qty));
end;
$$;

revoke execute on all functions in schema app from public, anon, authenticated;
grant execute on function app.current_tenant_id(), app.current_app_role(), app.is_manager(), app.is_owner(),
  app.visible_location_ids() to authenticated;

revoke execute on function public.save_dispatch_draft(uuid, uuid, jsonb, text) from public, anon;
grant execute on function public.save_dispatch_draft(uuid, uuid, jsonb, text) to authenticated;
revoke execute on function public.delete_dispatch_draft(uuid) from public, anon;
grant execute on function public.delete_dispatch_draft(uuid) to authenticated;
revoke execute on function public.send_dispatch(uuid, uuid) from public, anon;
grant execute on function public.send_dispatch(uuid, uuid) to authenticated;
revoke execute on function public.receive_dispatch(uuid, jsonb, uuid) from public, anon;
grant execute on function public.receive_dispatch(uuid, jsonb, uuid) to authenticated;
revoke execute on function public.resolve_discrepancy(uuid, public.discrepancy_resolution, text, uuid) from public, anon;
grant execute on function public.resolve_discrepancy(uuid, public.discrepancy_resolution, text, uuid) to authenticated;
