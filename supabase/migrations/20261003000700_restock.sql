-- Phase 5: restock requests — manual (store staff) and suggested (nightly job + on demand, staff approve per line).

create extension if not exists pg_cron with schema pg_catalog;

-- ---------------------------------------------------------------------------
-- Manual requests
-- ---------------------------------------------------------------------------

-- Create or update a request in DRAFT, optionally sending it straight away. p_lines: [{product_id, quantity}].
create function public.save_restock_request(
  p_id uuid,
  p_location_id uuid,
  p_lines jsonb,
  p_note text default null,
  p_send boolean default false,
  p_idempotency_key uuid default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_profile public.profiles := app.require_user(array['OWNER', 'STORE_STAFF']::public.app_role[]);
  v_tenant uuid := v_profile.tenant_id;
  v_prior jsonb;
  v_id uuid := p_id;
  v_req public.restock_requests;
  v_location public.locations;
  v_result jsonb;
begin
  v_prior := app.idempotency_begin(v_tenant, p_idempotency_key, 'save_restock_request');
  if v_prior is not null then
    return v_prior;
  end if;

  v_location := app.assert_location_access(v_profile, p_location_id);
  if v_location.kind <> 'STORE' then
    perform app.raise('BB_LOCATION_NOT_FOUND', 'Restock requests are made by stores.');
  end if;

  if v_id is null then
    insert into public.restock_requests (tenant_id, number, location_id, source, status, note, created_by)
    values (v_tenant, app.next_document_number(v_tenant, 'REQ'), p_location_id, 'MANUAL', 'DRAFT',
            nullif(trim(p_note), ''), v_profile.user_id)
    returning * into v_req;
    v_id := v_req.id;
  else
    select * into v_req from public.restock_requests where id = v_id and tenant_id = v_tenant for update;
    if v_req.id is null or v_req.location_id <> p_location_id then
      perform app.raise('BB_NOT_FOUND', 'That request was not found.');
    elsif v_req.status <> 'DRAFT' then
      perform app.raise('BB_NOT_DRAFT', 'This request has already been sent.');
    end if;
    update public.restock_requests set note = nullif(trim(p_note), '') where id = v_id;
    delete from public.restock_request_lines where request_id = v_id;
  end if;

  insert into public.restock_request_lines (tenant_id, request_id, product_id, quantity, line_status)
  select v_tenant, v_id, l.product_id, l.quantity, 'APPROVED' from app.parse_lines(v_tenant, p_lines) l;

  if p_send then
    update public.restock_requests set status = 'SENT', submitted_at = now(), submitted_by = v_profile.user_id
    where id = v_id;
    perform app.audit(v_tenant, 'restock.sent', 'restock_request', v_id, jsonb_build_object('number', v_req.number));
  end if;

  v_result := jsonb_build_object('request_id', v_id, 'number', v_req.number, 'sent', p_send);
  return app.idempotency_finish(v_tenant, p_idempotency_key, 'save_restock_request', v_result);
end;
$$;

create function public.delete_restock_draft(p_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_profile public.profiles := app.require_user(array['OWNER', 'STORE_STAFF']::public.app_role[]);
  v_req public.restock_requests;
begin
  select * into v_req from public.restock_requests where id = p_id and tenant_id = v_profile.tenant_id for update;
  if v_req.id is null then
    perform app.raise('BB_NOT_FOUND', 'That request was not found.');
  end if;
  perform app.assert_location_access(v_profile, v_req.location_id);
  if v_req.status not in ('DRAFT', 'WAITING_STAFF_APPROVAL') then
    perform app.raise('BB_NOT_DRAFT', 'Sent requests can''t be deleted.');
  end if;
  delete from public.restock_requests where id = p_id;
  perform app.audit(v_profile.tenant_id, 'restock.deleted', 'restock_request', p_id, jsonb_build_object('number', v_req.number));
end;
$$;

-- ---------------------------------------------------------------------------
-- Suggestions
-- ---------------------------------------------------------------------------

-- Products at or below their reorder level at one store that aren't already on an open request for that store.
-- Suggested quantity = max(1, reorder level × 2 − on hand).
create function app.restock_candidates(p_tenant_id uuid, p_location_id uuid)
returns table (product_id uuid, quantity integer)
language sql stable security definer set search_path = ''
as $$
  select p.id, greatest(1, p.reorder_level * 2 - coalesce(sl.quantity, 0))
  from public.products p
  left join public.stock_levels sl on sl.product_id = p.id and sl.location_id = p_location_id
  where p.tenant_id = p_tenant_id
    and p.active
    and p.reorder_level > 0
    and coalesce(sl.quantity, 0) <= p.reorder_level
    and not exists (
      select 1 from public.restock_request_lines rl
      join public.restock_requests r on r.id = rl.request_id
      where r.location_id = p_location_id
        and r.status in ('DRAFT', 'WAITING_STAFF_APPROVAL', 'SENT', 'APPROVED')
        and rl.product_id = p.id
        and rl.line_status <> 'SKIPPED'
    )
$$;
-- For one store: products at or below their reorder level that aren't already on an open request get a line on
-- the store's "Waiting for Staff Approval" request (created if needed). Quantity = max(1, reorder × 2 − on hand).
-- Returns the number of new lines.
create function app.generate_suggestions_for_location(p_tenant_id uuid, p_location_id uuid)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_req_id uuid;
  v_count integer;
begin
  -- Serialise per store so the nightly job and the button can't create duplicate requests.
  perform pg_advisory_xact_lock(hashtextextended('restock-suggest:' || p_location_id::text, 0));

  select count(*) into v_count from app.restock_candidates(p_tenant_id, p_location_id);
  if v_count = 0 then
    return 0;
  end if;

  select id into v_req_id from public.restock_requests
  where location_id = p_location_id and status = 'WAITING_STAFF_APPROVAL' and source = 'SUGGESTED'
  order by created_at desc limit 1;
  if v_req_id is null then
    insert into public.restock_requests (tenant_id, number, location_id, source, status, note)
    values (p_tenant_id, app.next_document_number(p_tenant_id, 'REQ'), p_location_id, 'SUGGESTED',
            'WAITING_STAFF_APPROVAL', 'Suggested: items at or below their reorder level')
    returning id into v_req_id;
  end if;

  insert into public.restock_request_lines (tenant_id, request_id, product_id, quantity, suggested_quantity, line_status)
  select p_tenant_id, v_req_id, s.product_id, s.quantity, s.quantity, 'PENDING'
  from app.restock_candidates(p_tenant_id, p_location_id) s
  on conflict (request_id, product_id) do update
    set quantity = excluded.quantity, suggested_quantity = excluded.suggested_quantity, line_status = 'PENDING';

  insert into public.audit_log (tenant_id, user_id, action, entity_type, entity_id, details)
  values (p_tenant_id, auth.uid(), 'restock.suggested', 'restock_request', v_req_id, jsonb_build_object('lines', v_count));
  return v_count;
end;
$$;

-- On-demand button for store staff (their store) or the owner (a given store).
create function public.generate_restock_suggestions(p_location_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_profile public.profiles := app.require_user(array['OWNER', 'STORE_STAFF']::public.app_role[]);
  v_location public.locations := app.assert_location_access(v_profile, p_location_id);
  v_count integer;
begin
  if v_location.kind <> 'STORE' then
    perform app.raise('BB_LOCATION_NOT_FOUND', 'Suggestions are made for stores.');
  end if;
  v_count := app.generate_suggestions_for_location(v_profile.tenant_id, p_location_id);
  return jsonb_build_object('lines', v_count);
end;
$$;

-- Nightly job: every active store of every tenant that can still write.
create function app.run_nightly_suggestions()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  r record;
  v_total integer := 0;
begin
  for r in
    select l.tenant_id, l.id from public.locations l
    join public.tenants t on t.id = l.tenant_id
    where l.kind = 'STORE' and l.active
      and (t.status = 'active' or (t.status = 'trial' and t.trial_ends_at >= now()))
  loop
    v_total := v_total + app.generate_suggestions_for_location(r.tenant_id, r.id);
  end loop;
  return v_total;
end;
$$;

-- 02:00 IST every night.
select cron.schedule('restock-suggestions', '30 20 * * *', $$select app.run_nightly_suggestions()$$);

-- Staff review of a suggested line: APPROVE (optionally with a new quantity) or SKIP.
create function public.review_suggestion_line(p_line_id uuid, p_action text, p_quantity integer default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_profile public.profiles := app.require_user(array['OWNER', 'STORE_STAFF']::public.app_role[]);
  v_line public.restock_request_lines;
  v_req public.restock_requests;
begin
  select * into v_line from public.restock_request_lines where id = p_line_id and tenant_id = v_profile.tenant_id for update;
  select * into v_req from public.restock_requests where id = v_line.request_id;
  if v_line.id is null then
    perform app.raise('BB_NOT_FOUND', 'That line was not found.');
  end if;
  perform app.assert_location_access(v_profile, v_req.location_id);
  if v_req.status <> 'WAITING_STAFF_APPROVAL' then
    perform app.raise('BB_NOT_WAITING', 'This request has already been forwarded.');
  end if;
  if p_action = 'APPROVE' then
    if p_quantity is not null and (p_quantity < 1 or p_quantity > 100000) then
      perform app.raise('BB_INVALID_QUANTITY', 'Quantities must be whole numbers between 1 and 100,000.');
    end if;
    update public.restock_request_lines
    set line_status = 'APPROVED', quantity = coalesce(p_quantity, quantity) where id = p_line_id;
  elsif p_action = 'SKIP' then
    update public.restock_request_lines set line_status = 'SKIPPED' where id = p_line_id;
  else
    perform app.raise('BB_INVALID_ACTION', 'Unknown action.');
  end if;
end;
$$;

-- Staff forward a reviewed suggestion to the Store Room. Every line must be approved or skipped first.
create function public.forward_suggestions(p_request_id uuid, p_idempotency_key uuid default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_profile public.profiles := app.require_user(array['OWNER', 'STORE_STAFF']::public.app_role[]);
  v_prior jsonb;
  v_req public.restock_requests;
  v_result jsonb;
begin
  v_prior := app.idempotency_begin(v_profile.tenant_id, p_idempotency_key, 'forward_suggestions');
  if v_prior is not null then
    return v_prior;
  end if;
  select * into v_req from public.restock_requests where id = p_request_id and tenant_id = v_profile.tenant_id for update;
  if v_req.id is null then
    perform app.raise('BB_NOT_FOUND', 'That request was not found.');
  end if;
  perform app.assert_location_access(v_profile, v_req.location_id);
  if v_req.status <> 'WAITING_STAFF_APPROVAL' then
    perform app.raise('BB_NOT_WAITING', 'This request has already been forwarded.');
  end if;
  if exists (select 1 from public.restock_request_lines where request_id = p_request_id and line_status = 'PENDING') then
    perform app.raise('BB_LINES_PENDING', 'Approve or skip every line before forwarding.');
  end if;
  if not exists (select 1 from public.restock_request_lines where request_id = p_request_id and line_status = 'APPROVED') then
    perform app.raise('BB_NO_LINES', 'Approve at least one line, or delete the suggestion.');
  end if;

  update public.restock_requests set status = 'SENT', submitted_at = now(), submitted_by = v_profile.user_id
  where id = p_request_id;
  perform app.audit(v_profile.tenant_id, 'restock.forwarded', 'restock_request', p_request_id,
    jsonb_build_object('number', v_req.number));
  v_result := jsonb_build_object('request_id', p_request_id, 'number', v_req.number);
  return app.idempotency_finish(v_profile.tenant_id, p_idempotency_key, 'forward_suggestions', v_result);
end;
$$;

-- ---------------------------------------------------------------------------
-- Store Room decision. Approving creates a pre-filled DRAFT dispatch (one click) and returns its id.
-- ---------------------------------------------------------------------------
create function public.decide_restock_request(
  p_id uuid,
  p_approve boolean,
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
  v_req public.restock_requests;
  v_dispatch_id uuid;
  v_result jsonb;
begin
  v_prior := app.idempotency_begin(v_tenant, p_idempotency_key, 'decide_restock_request');
  if v_prior is not null then
    return v_prior;
  end if;
  select * into v_req from public.restock_requests where id = p_id and tenant_id = v_tenant for update;
  if v_req.id is null or v_req.status in ('DRAFT', 'WAITING_STAFF_APPROVAL') then
    perform app.raise('BB_NOT_FOUND', 'That request was not found.');
  elsif v_req.status <> 'SENT' then
    perform app.raise('BB_ALREADY_DECIDED', 'This request has already been decided.');
  end if;

  if not p_approve then
    if nullif(trim(p_note), '') is null then
      perform app.raise('BB_NOTE_REQUIRED', 'Tell the store why the request is rejected.');
    end if;
    update public.restock_requests
    set status = 'REJECTED', decided_at = now(), decided_by = v_profile.user_id, decision_note = trim(p_note)
    where id = p_id;
    perform app.audit(v_tenant, 'restock.rejected', 'restock_request', p_id, jsonb_build_object('number', v_req.number));
    v_result := jsonb_build_object('request_id', p_id, 'status', 'REJECTED');
  else
    insert into public.dispatches (tenant_id, number, from_location_id, to_location_id, restock_request_id, note, created_by)
    values (v_tenant, app.next_document_number(v_tenant, 'DSP'), app.store_room_id(v_tenant), v_req.location_id, p_id,
            'For request ' || v_req.number, v_profile.user_id)
    returning id into v_dispatch_id;
    insert into public.dispatch_lines (tenant_id, dispatch_id, product_id, quantity_sent)
    select v_tenant, v_dispatch_id, product_id, quantity
    from public.restock_request_lines where request_id = p_id and line_status = 'APPROVED';

    update public.restock_requests
    set status = 'APPROVED', decided_at = now(), decided_by = v_profile.user_id, decision_note = nullif(trim(p_note), '')
    where id = p_id;
    perform app.audit(v_tenant, 'restock.approved', 'restock_request', p_id,
      jsonb_build_object('number', v_req.number, 'dispatch_id', v_dispatch_id));
    v_result := jsonb_build_object('request_id', p_id, 'status', 'APPROVED', 'dispatch_id', v_dispatch_id);
  end if;
  return app.idempotency_finish(v_tenant, p_idempotency_key, 'decide_restock_request', v_result);
end;
$$;

revoke execute on all functions in schema app from public, anon, authenticated;
grant execute on function app.current_tenant_id(), app.current_app_role(), app.is_manager(), app.is_owner(),
  app.visible_location_ids() to authenticated;

revoke execute on function public.save_restock_request(uuid, uuid, jsonb, text, boolean, uuid) from public, anon;
grant execute on function public.save_restock_request(uuid, uuid, jsonb, text, boolean, uuid) to authenticated;
revoke execute on function public.delete_restock_draft(uuid) from public, anon;
grant execute on function public.delete_restock_draft(uuid) to authenticated;
revoke execute on function public.generate_restock_suggestions(uuid) from public, anon;
grant execute on function public.generate_restock_suggestions(uuid) to authenticated;
revoke execute on function public.review_suggestion_line(uuid, text, integer) from public, anon;
grant execute on function public.review_suggestion_line(uuid, text, integer) to authenticated;
revoke execute on function public.forward_suggestions(uuid, uuid) from public, anon;
grant execute on function public.forward_suggestions(uuid, uuid) to authenticated;
revoke execute on function public.decide_restock_request(uuid, boolean, text, uuid) from public, anon;
grant execute on function public.decide_restock_request(uuid, boolean, text, uuid) to authenticated;
