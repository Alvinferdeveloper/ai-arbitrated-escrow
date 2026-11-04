-- Fraud checks on seller evidence: a handwritten verification code per deal,
-- sample deals for the demo, and the new rule ids.

create or replace function public.new_verification_code()
returns text
language sql
volatile
set search_path = ''
as $$
  -- No 0/O or 1/I/L, so the handwritten code reads back unambiguously.
  select string_agg(
    substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1),
    ''
  )
  from generate_series(1, 4);
$$;

-- Existing deals keep a null code, so the check is skipped for them.
alter table public.deals
  add column verification_code text
    check (verification_code is null or verification_code ~ '^[A-HJ-KM-NP-Z2-9]{4}$'),
  add column is_sample boolean not null default false;

alter table public.deals
  alter column verification_code set default public.new_verification_code();

create index evidence_sha256_idx on public.evidence (sha256);

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
      'HIGH_VALUE',
      'VERIFICATION_CODE',
      'GUIDE_PREDATES_DEAL',
      'TRACKING_FORMAT',
      'REUSED_PHOTO',
      'EDITED_PHOTO',
      'OLD_PHOTO'
    ]::text[]
  );

notify pgrst, 'reload schema';
