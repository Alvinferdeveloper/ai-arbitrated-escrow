-- Any deal amount from 1.00 USD; 100,000.00 USD is only a typo guard.
-- Large deals are reviewed through the HIGH_VALUE escalation rule.

alter table public.deals drop constraint deals_price_cents_check;
alter table public.deals add constraint deals_price_cents_check
  check (price_cents between 100 and 10000000);

alter table public.ai_audits drop constraint ai_audits_triggered_rules_check;
alter table public.ai_audits add constraint ai_audits_triggered_rules_check
  check (
    triggered_rules <@ array[
      'PRODUCT_MISMATCH',
      'WEIGHT_OUT_OF_RANGE',
      'UNREADABLE_GUIDE',
      'CONFLICTING_EVIDENCE',
      'TECHNICAL_FAILURE',
      'OUT_OF_BAND_REVERSAL',
      'HIGH_VALUE'
    ]::text[]
  );

create or replace function public.create_deal(
  p_seller_id uuid,
  p_buyer_id uuid,
  p_title text,
  p_description text,
  p_price_cents integer,
  p_delivery_estimate_days integer
)
returns table (
  deal_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  trimmed_title text;
  seller_row public.users%rowtype;
  buyer_row public.users%rowtype;
  new_deal_id public.deals.id%type;
begin
  trimmed_title := btrim(coalesce(p_title, ''));
  if length(trimmed_title) < 1 or length(trimmed_title) > 140 then
    raise exception using errcode = '22023', message = 'invalid_title';
  end if;

  if p_price_cents is null
     or p_price_cents < 100
     or p_price_cents > 10000000 then
    raise exception using errcode = '22023', message = 'invalid_price';
  end if;

  if p_delivery_estimate_days is null
     or p_delivery_estimate_days < 1
     or p_delivery_estimate_days > 14 then
    raise exception using errcode = '22023', message = 'invalid_delivery_estimate';
  end if;

  if p_seller_id is null or p_buyer_id is null or p_seller_id = p_buyer_id then
    raise exception using errcode = '22023', message = 'same_party';
  end if;

  select * into seller_row from public.users where id = p_seller_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'seller_not_found';
  end if;

  if seller_row.role <> 'seller' or seller_row.paypal_email is null then
    raise exception using errcode = '22023',
          message = 'seller_not_eligible',
          detail = seller_row.role::text;
  end if;

  select * into buyer_row from public.users where id = p_buyer_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'buyer_not_found';
  end if;

  if buyer_row.role <> 'buyer' then
    raise exception using errcode = '22023',
          message = 'buyer_not_eligible',
          detail = buyer_row.role::text;
  end if;

  insert into public.deals (
    seller_id,
    buyer_id,
    title,
    description,
    price_cents,
    delivery_estimate_days
  )
  values (
    p_seller_id,
    p_buyer_id,
    trimmed_title,
    coalesce(btrim(p_description), ''),
    p_price_cents,
    p_delivery_estimate_days
  )
  returning deals.id into new_deal_id;

  insert into public.events (deal_id, actor, from_state, to_state, payload)
  values (
    new_deal_id,
    'system',
    null,
    'AWAITING_PAYMENT',
    jsonb_build_object(
      'title', 'Deal created',
      'detail', 'The seller opened the deal and shared the Trust Link with the buyer.'
    )
  );

  return query select new_deal_id;
end;
$$;

revoke all on function public.create_deal(
  uuid, uuid, text, text, integer, integer
) from public;

grant execute on function public.create_deal(
  uuid, uuid, text, text, integer, integer
) to service_role;

notify pgrst, 'reload schema';

