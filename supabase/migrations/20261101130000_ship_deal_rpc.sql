-- Moves a deal to SHIPPED from AUDITING (ai) or ESCALATED (mediator), storing the
-- tracking and the auto-release deadline in the same transaction.
-- Demo mode passes p_day_ms = 0, so the deadline is the grace period alone.

create or replace function public.ship_deal(
  p_deal_id uuid,
  p_from public.deal_state,
  p_actor public.actor,
  p_payload jsonb,
  p_carrier text,
  p_tracking_number text,
  p_day_ms bigint,
  p_grace_ms bigint
)
returns table (
  event_id bigint,
  deal_id uuid,
  from_state public.deal_state,
  to_state public.deal_state,
  actor public.actor,
  payload jsonb,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_state public.deals.state%type;
  current_shipped_at public.deals.shipped_at%type;
  estimate_days public.deals.delivery_estimate_days%type;
begin
  if p_from not in ('AUDITING', 'ESCALATED') then
    raise exception using errcode = '22023', message = 'invalid_ship_source';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception using errcode = '22023', message = 'payload_must_be_object';
  end if;

  if p_day_ms is null or p_day_ms < 0 or p_grace_ms is null or p_grace_ms < 0 then
    raise exception using errcode = '22023', message = 'invalid_deadline';
  end if;

  select d.state, d.shipped_at, d.delivery_estimate_days
    into current_state, current_shipped_at, estimate_days
    from public.deals as d
   where d.id = p_deal_id
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'deal_not_found';
  end if;

  if current_state <> p_from then
    raise exception
      using errcode = '40001',
            message = 'deal_state_conflict',
            detail = current_state::text;
  end if;

  -- A dispute case is settled with a release or refund, never re-shipped.
  if p_from = 'ESCALATED' and (
    current_shipped_at is not null
    or exists (
      select 1 from public.disputes as ds
       where ds.deal_id = p_deal_id and ds.status = 'OPEN'
    )
  ) then
    raise exception
      using errcode = '40001',
            message = 'deal_already_shipped',
            detail = current_state::text;
  end if;

  update public.deals
     set state = 'SHIPPED',
         shipped_at = now(),
         carrier = coalesce(nullif(btrim(coalesce(p_carrier, '')), ''), carrier),
         tracking_number = coalesce(
           nullif(btrim(coalesce(p_tracking_number, '')), ''),
           tracking_number
         ),
         auto_release_at = now()
           + make_interval(secs => (coalesce(estimate_days, 0) * p_day_ms + p_grace_ms) / 1000.0)
   where id = p_deal_id;

  return query
    insert into public.events (deal_id, actor, from_state, to_state, payload)
    values (p_deal_id, p_actor, p_from, 'SHIPPED', p_payload)
    returning events.id,
              events.deal_id,
              events.from_state,
              events.to_state,
              events.actor,
              events.payload,
              events.created_at;
end;
$$;

revoke all on function public.ship_deal(
  uuid, public.deal_state, public.actor, jsonb, text, text, bigint, bigint
) from public;
grant execute on function public.ship_deal(
  uuid, public.deal_state, public.actor, jsonb, text, text, bigint, bigint
) to service_role;

notify pgrst, 'reload schema';
