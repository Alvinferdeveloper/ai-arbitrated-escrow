-- Queues the payout for a shipped deal (FR7): the buyer confirmed receipt, or
-- the auto-release cron reached the deadline. Like a mediator release, this is
-- a settlement request, not a state change. The deal stays SHIPPED and becomes
-- RELEASED only when PayPal's payout webhook confirms the money moved.

create or replace function public.request_release(
  p_deal_id uuid,
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
begin
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

  if current_state <> 'SHIPPED' then
    raise exception
      using errcode = '40001',
            message = 'deal_not_shipped',
            detail = current_state::text;
  end if;

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
    if existing_purpose <> 'PAYOUT' then
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

  return query
    insert into public.payments (
      deal_id, purpose, status, amount_cents, idempotency_key
    )
    values (
      p_deal_id, 'PAYOUT', 'PENDING', deal_amount, btrim(p_idempotency_key)
    )
    returning payments.id,
              payments.purpose,
              payments.status,
              payments.idempotency_key,
              payments.created_at;
end;
$$;

revoke all on function public.request_release(uuid, text) from public;
grant execute on function public.request_release(uuid, text) to service_role;

notify pgrst, 'reload schema';
