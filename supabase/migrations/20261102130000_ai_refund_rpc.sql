-- Moves a deal to REFUNDING and queues the refund row in one transaction.
-- Called when the audit finds a different item, the seller runs out of
-- attempts, or the evidence deadline passes.

create or replace function public.start_ai_refund(
  p_deal_id uuid,
  p_from public.deal_state,
  p_actor public.actor,
  p_payload jsonb,
  p_idempotency_key text
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
  deal_amount public.deals.price_cents%type;
begin
  if p_from not in ('FUNDS_HELD', 'AUDITING', 'EVIDENCE_REJECTED') then
    raise exception using errcode = '22023', message = 'invalid_refund_source';
  end if;

  if p_actor not in ('ai', 'system') then
    raise exception using errcode = '22023', message = 'invalid_refund_actor';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception using errcode = '22023', message = 'payload_must_be_object';
  end if;

  if p_idempotency_key is null
     or length(btrim(p_idempotency_key)) not between 8 and 128 then
    raise exception using errcode = '22023', message = 'invalid_idempotency_key';
  end if;

  select d.state, d.price_cents
    into current_state, deal_amount
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

  if exists (
    select 1 from public.payments as p
     where p.deal_id = p_deal_id and p.purpose in ('PAYOUT', 'REFUND')
  ) then
    raise exception
      using errcode = '40001',
            message = 'deal_state_conflict',
            detail = current_state::text;
  end if;

  insert into public.payments (deal_id, purpose, status, amount_cents, idempotency_key)
  values (p_deal_id, 'REFUND', 'PENDING', deal_amount, btrim(p_idempotency_key));

  update public.deals
     set state = 'REFUNDING'
   where id = p_deal_id;

  return query
    insert into public.events (deal_id, actor, from_state, to_state, payload)
    values (p_deal_id, p_actor, p_from, 'REFUNDING', p_payload)
    returning events.id,
              events.deal_id,
              events.from_state,
              events.to_state,
              events.actor,
              events.payload,
              events.created_at;
end;
$$;

revoke all on function public.start_ai_refund(
  uuid, public.deal_state, public.actor, jsonb, text
) from public;
grant execute on function public.start_ai_refund(
  uuid, public.deal_state, public.actor, jsonb, text
) to service_role;

notify pgrst, 'reload schema';
