-- Buyer disputes: open the dispute, submit the unboxing photo (D) and queue
-- the settlement an arbitration verdict asks for. Each runs in one transaction.

create or replace function public.open_dispute(
  p_deal_id uuid,
  p_reason text,
  p_payload jsonb
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
  buyer public.deals.buyer_id%type;
  release_at public.deals.auto_release_at%type;
begin
  if p_reason is null or length(btrim(p_reason)) not between 1 and 2000 then
    raise exception using errcode = '22023', message = 'invalid_reason';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception using errcode = '22023', message = 'payload_must_be_object';
  end if;

  select d.state, d.buyer_id, d.auto_release_at
    into current_state, buyer, release_at
    from public.deals as d
   where d.id = p_deal_id
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'deal_not_found';
  end if;

  if current_state <> 'SHIPPED' then
    raise exception
      using errcode = '40001',
            message = 'deal_state_conflict',
            detail = current_state::text;
  end if;

  if release_at is not null and release_at <= now() then
    raise exception using errcode = '22023', message = 'dispute_window_closed';
  end if;

  -- A confirmed receipt already queued the payout.
  if exists (
    select 1 from public.payments as p
     where p.deal_id = p_deal_id and p.purpose in ('PAYOUT', 'REFUND')
  ) then
    raise exception using errcode = '22023', message = 'settlement_already_queued';
  end if;

  insert into public.disputes (deal_id, opened_by, reason)
  values (p_deal_id, buyer, btrim(p_reason));

  update public.deals
     set state = 'DISPUTED'
   where id = p_deal_id;

  return query
    insert into public.events (deal_id, actor, from_state, to_state, payload)
    values (p_deal_id, 'buyer', 'SHIPPED', 'DISPUTED', p_payload)
    returning events.id,
              events.deal_id,
              events.from_state,
              events.to_state,
              events.actor,
              events.payload,
              events.created_at;
end;
$$;

create or replace function public.submit_unboxing(
  p_deal_id uuid,
  p_payload jsonb,
  p_item jsonb,
  p_prompt_version text
)
returns table (
  audit_id uuid,
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
  buyer public.deals.buyer_id%type;
  new_audit_id public.ai_audits.id%type;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception using errcode = '22023', message = 'payload_must_be_object';
  end if;

  if p_item is null or jsonb_typeof(p_item) <> 'object' or p_item->>'type' <> 'D' then
    raise exception using errcode = '22023', message = 'invalid_unboxing_photo';
  end if;

  select d.state, d.buyer_id
    into current_state, buyer
    from public.deals as d
   where d.id = p_deal_id
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'deal_not_found';
  end if;

  if current_state <> 'DISPUTED' then
    raise exception
      using errcode = '40001',
            message = 'deal_state_conflict',
            detail = current_state::text;
  end if;

  if not exists (
    select 1 from public.disputes as ds
     where ds.deal_id = p_deal_id and ds.status = 'OPEN'
  ) then
    raise exception using errcode = '22023', message = 'no_open_dispute';
  end if;

  update public.evidence as e
     set superseded_at = now()
   where e.deal_id = p_deal_id
     and e.type = 'D'
     and e.superseded_at is null;

  insert into public.evidence (
    deal_id, type, uploaded_by, storage_path, sha256, mime_type,
    size_bytes, width, height, exif
  )
  values (
    p_deal_id,
    'D',
    buyer,
    p_item->>'storage_path',
    p_item->>'sha256',
    p_item->>'mime_type',
    (p_item->>'size_bytes')::bigint,
    (p_item->>'width')::integer,
    (p_item->>'height')::integer,
    coalesce(p_item->'exif', '{}'::jsonb)
  );

  insert into public.ai_audits (deal_id, kind, status, prompt_version)
  values (p_deal_id, 'ARBITRATION', 'PENDING', p_prompt_version)
  returning id into new_audit_id;

  update public.deals
     set state = 'ARBITRATING'
   where id = p_deal_id;

  return query
    insert into public.events (deal_id, actor, from_state, to_state, payload)
    values (
      p_deal_id,
      'buyer',
      'DISPUTED',
      'ARBITRATING',
      p_payload || jsonb_build_object('auditId', new_audit_id)
    )
    returning new_audit_id,
              events.id,
              events.deal_id,
              events.from_state,
              events.to_state,
              events.actor,
              events.payload,
              events.created_at;
end;
$$;

-- Like a mediator decision, a verdict only queues the payment row; the deal
-- stays ARBITRATING until PayPal's webhook confirms the money moved.
create or replace function public.queue_arbitration_settlement(
  p_deal_id uuid,
  p_purpose public.payment_purpose,
  p_reason text,
  p_idempotency_key text
)
returns table (
  payment_id uuid,
  purpose public.payment_purpose,
  status public.payment_status,
  idempotency_key text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_state public.deals.state%type;
  deal_amount public.deals.price_cents%type;
  existing public.payments%rowtype;
begin
  if p_purpose not in ('PAYOUT', 'REFUND') then
    raise exception using errcode = '22023', message = 'invalid_settlement_purpose';
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

  if current_state <> 'ARBITRATING' then
    raise exception
      using errcode = '40001',
            message = 'deal_state_conflict',
            detail = current_state::text;
  end if;

  select * into existing
    from public.payments as p
   where p.deal_id = p_deal_id
     and p.purpose in ('PAYOUT', 'REFUND')
   order by p.created_at
   limit 1;

  if found then
    if existing.purpose <> p_purpose then
      raise exception
        using errcode = '40001',
              message = 'settlement_already_queued',
              detail = existing.purpose::text;
    end if;

    return query
      select existing.id, existing.purpose, existing.status,
             existing.idempotency_key, existing.created_at;
    return;
  end if;

  -- Aliased: `status` alone would clash with the output column of the same name.
  update public.disputes as ds
     set status = 'DECIDED',
         verdict = case
           when p_purpose = 'PAYOUT' then 'RELEASE'::public.dispute_verdict
           else 'REFUND'::public.dispute_verdict
         end,
         decided_by = 'ai',
         mediator_note = nullif(btrim(coalesce(p_reason, '')), ''),
         decided_at = now()
   where ds.deal_id = p_deal_id
     and ds.status = 'OPEN';

  return query
    insert into public.payments (deal_id, purpose, status, amount_cents, idempotency_key)
    values (p_deal_id, p_purpose, 'PENDING', deal_amount, btrim(p_idempotency_key))
    returning payments.id,
              payments.purpose,
              payments.status,
              payments.idempotency_key,
              payments.created_at;
end;
$$;

revoke all on function public.open_dispute(uuid, text, jsonb) from public;
revoke all on function public.submit_unboxing(uuid, jsonb, jsonb, text) from public;
revoke all on function public.queue_arbitration_settlement(
  uuid, public.payment_purpose, text, text
) from public;

grant execute on function public.open_dispute(uuid, text, jsonb) to service_role;
grant execute on function public.submit_unboxing(uuid, jsonb, jsonb, text) to service_role;
grant execute on function public.queue_arbitration_settlement(
  uuid, public.payment_purpose, text, text
) to service_role;

notify pgrst, 'reload schema';
