-- Stores photos A, B and C, opens a PENDING evidence audit and moves the deal
-- to AUDITING in one transaction. The photos are already in the bucket.

create or replace function public.submit_evidence(
  p_deal_id uuid,
  p_from public.deal_state,
  p_payload jsonb,
  p_items jsonb,
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
  seller public.deals.seller_id%type;
  new_audit_id public.ai_audits.id%type;
begin
  if p_from not in ('FUNDS_HELD', 'EVIDENCE_REJECTED') then
    raise exception using errcode = '22023', message = 'invalid_evidence_source';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception using errcode = '22023', message = 'payload_must_be_object';
  end if;

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) <> 3
     or (
       select count(distinct item->>'type')
         from jsonb_array_elements(p_items) as item
        where item->>'type' in ('A', 'B', 'C')
     ) <> 3 then
    raise exception using errcode = '22023', message = 'incomplete_evidence';
  end if;

  select d.state, d.seller_id
    into current_state, seller
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

  update public.evidence as e
     set superseded_at = now()
   where e.deal_id = p_deal_id
     and e.type in ('A', 'B', 'C')
     and e.superseded_at is null;

  insert into public.evidence (
    deal_id, type, uploaded_by, storage_path, sha256, mime_type,
    size_bytes, width, height, exif
  )
  select p_deal_id,
         (item->>'type')::public.evidence_type,
         seller,
         item->>'storage_path',
         item->>'sha256',
         item->>'mime_type',
         (item->>'size_bytes')::bigint,
         (item->>'width')::integer,
         (item->>'height')::integer,
         coalesce(item->'exif', '{}'::jsonb)
    from jsonb_array_elements(p_items) as item;

  insert into public.ai_audits (deal_id, kind, status, prompt_version)
  values (p_deal_id, 'EVIDENCE_AUDIT', 'PENDING', p_prompt_version)
  returning id into new_audit_id;

  update public.deals
     set state = 'AUDITING'
   where id = p_deal_id;

  return query
    insert into public.events (deal_id, actor, from_state, to_state, payload)
    values (
      p_deal_id,
      'seller',
      p_from,
      'AUDITING',
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

revoke all on function public.submit_evidence(
  uuid, public.deal_state, jsonb, jsonb, text
) from public;
grant execute on function public.submit_evidence(
  uuid, public.deal_state, jsonb, jsonb, text
) to service_role;

notify pgrst, 'reload schema';
