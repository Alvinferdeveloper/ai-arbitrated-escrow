-- Starts the PayPal checkout for a deal that is still awaiting payment (FR3).
--
-- The CAPTURE payment row and its idempotency key are written in the same
-- transaction, before any call to PayPal, so a retry can always reuse the key.
-- The amount comes from the deal row, never from the browser.

create or replace function public.begin_capture(
  p_deal_id uuid,
  p_idempotency_key text
)
returns table (
  payment_id uuid,
  deal_id uuid,
  title text,
  amount_cents integer,
  currency text,
  status public.payment_status,
  paypal_order_id text,
  idempotency_key text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_state public.deals.state%type;
  current_price integer;
  current_title text;
  existing public.payments%rowtype;
begin
  if p_idempotency_key is null
     or length(p_idempotency_key) < 8
     or length(p_idempotency_key) > 128 then
    raise exception using errcode = '22023', message = 'invalid_idempotency_key';
  end if;

  select d.state, d.price_cents, d.title
    into current_state, current_price, current_title
    from public.deals as d
   where d.id = p_deal_id
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'deal_not_found';
  end if;

  if current_state <> 'AWAITING_PAYMENT' then
    raise exception using errcode = '22023', message = 'deal_not_awaiting_payment';
  end if;

  select *
    into existing
    from public.payments as p
   where p.deal_id = p_deal_id
     and p.purpose = 'CAPTURE'
   for update;

  if not found then
    return query
      insert into public.payments (
        deal_id, purpose, status, amount_cents, currency, idempotency_key
      )
      values (
        p_deal_id, 'CAPTURE', 'CREATED', current_price, 'USD', p_idempotency_key
      )
      returning payments.id,
                payments.deal_id,
                current_title,
                payments.amount_cents,
                payments.currency,
                payments.status,
                payments.paypal_order_id,
                payments.idempotency_key;
  end if;

  if existing.status in ('APPROVED', 'PENDING', 'COMPLETED') then
    raise exception using errcode = '22023', message = 'payment_in_progress';
  end if;

  return query
    update public.payments as p
       set status = 'CREATED',
           amount_cents = current_price,
           currency = 'USD',
           idempotency_key = p_idempotency_key,
           failure_reason = null,
           updated_at = now()
     where p.id = existing.id
    returning p.id,
              p.deal_id,
              current_title,
              p.amount_cents,
              p.currency,
              p.status,
              p.paypal_order_id,
              p.idempotency_key;
end;
$$;

revoke all on function public.begin_capture(uuid, text) from public;
grant execute on function public.begin_capture(uuid, text) to service_role;

notify pgrst, 'reload schema';
