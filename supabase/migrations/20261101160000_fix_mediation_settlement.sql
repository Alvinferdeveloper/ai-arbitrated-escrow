-- queue_mediation_settlement referenced `status` unqualified while also
-- returning a `status` column, which PL/pgSQL rejects as ambiguous.

create or replace function public.queue_mediation_settlement(
  p_deal_id uuid,
  p_purpose public.payment_purpose,
  p_note text,
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
  existing_payment_id public.payments.id%type;
  existing_purpose public.payments.purpose%type;
  existing_status public.payments.status%type;
  existing_key public.payments.idempotency_key%type;
  existing_created_at public.payments.created_at%type;
  new_payment_id public.payments.id%type;
  new_purpose public.payments.purpose%type;
  new_status public.payments.status%type;
  new_key public.payments.idempotency_key%type;
  new_created_at public.payments.created_at%type;
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

  if current_state <> 'ESCALATED' then
    raise exception
      using errcode = '40001',
            message = 'mediation_state_conflict',
            detail = current_state::text;
  end if;

  -- One settlement per deal. Repeating the same action is idempotent; asking
  -- for the opposite action after a settlement was queued is a conflict.
  select p.id, p.purpose, p.status, p.idempotency_key, p.created_at
    into existing_payment_id,
         existing_purpose,
         existing_status,
         existing_key,
         existing_created_at
    from public.payments as p
   where p.deal_id = p_deal_id
     and p.purpose in ('PAYOUT', 'REFUND')
   order by p.created_at
   limit 1;

  if found then
    if existing_purpose <> p_purpose then
      raise exception
        using errcode = '40001',
              message = 'settlement_already_queued',
              detail = existing_purpose::text;
    end if;

    return query
      select existing_payment_id,
             existing_purpose,
             existing_status,
             existing_key,
             existing_created_at;
    return;
  end if;

  insert into public.payments (
    deal_id,
    purpose,
    status,
    amount_cents,
    idempotency_key
  )
  values (
    p_deal_id,
    p_purpose,
    'PENDING',
    deal_amount,
    btrim(p_idempotency_key)
  )
  returning id, purpose, status, idempotency_key, created_at
    into new_payment_id, new_purpose, new_status, new_key, new_created_at;

  update public.disputes as ds
     set status = 'DECIDED',
         verdict = case
           when p_purpose = 'PAYOUT' then 'RELEASE'::public.dispute_verdict
           else 'REFUND'::public.dispute_verdict
         end,
         decided_by = 'mediator',
         mediator_note = nullif(btrim(coalesce(p_note, '')), ''),
         decided_at = now()
   where ds.deal_id = p_deal_id
     and ds.status = 'OPEN';

  return query
    select new_payment_id,
           new_purpose,
           new_status,
           new_key,
           new_created_at;
end;
$$;

notify pgrst, 'reload schema';
