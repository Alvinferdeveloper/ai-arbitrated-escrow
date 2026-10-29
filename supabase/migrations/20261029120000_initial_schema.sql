-- Project Shield: initial schema (7 tables), row-level security and the private evidence bucket.
--
-- Money invariants enforced here:
--   * USD only, 10.00 to 100.00 USD per deal (stored in cents).
--   * The seller cannot be the buyer.
--   * A seller always has a PayPal email for Payouts.
--   * One capture, one payout and one refund row per deal.
--   * Evidence keeps its SHA-256 and EXIF, and only one current photo per slot.
--
-- RLS is enabled on every table. There are read policies for a future signed-in
-- user and no write policies: server-only code uses the service role, which
-- bypasses RLS after checking the actor. Anon and authenticated clients cannot
-- write directly, and the evidence bucket is private.

-- Enums ---------------------------------------------------------------------

create type public.user_role as enum ('buyer', 'seller', 'mediator');

create type public.deal_state as enum (
  'AWAITING_PAYMENT',
  'FUNDS_HELD',
  'AUDITING',
  'EVIDENCE_REJECTED',
  'SHIPPED',
  'DISPUTED',
  'ARBITRATING',
  'ESCALATED',
  'RELEASED',
  'REFUNDED'
);

create type public.actor as enum ('buyer', 'seller', 'mediator', 'ai', 'system', 'paypal');

create type public.evidence_type as enum ('A', 'B', 'C', 'D');

create type public.payment_purpose as enum ('CAPTURE', 'PAYOUT', 'REFUND');

create type public.payment_status as enum (
  'CREATED',
  'APPROVED',
  'PENDING',
  'COMPLETED',
  'FAILED',
  'DENIED',
  'REFUNDED',
  'REVERSED',
  'BLOCKED',
  'RETURNED',
  'UNCLAIMED'
);

create type public.audit_kind as enum ('EVIDENCE_AUDIT', 'ARBITRATION');

create type public.audit_status as enum ('PENDING', 'RUNNING', 'DONE', 'FAILED');

create type public.dispute_status as enum ('OPEN', 'DECIDED');

create type public.dispute_verdict as enum ('RELEASE', 'REFUND', 'ESCALATE');

create type public.decider as enum ('ai', 'mediator');

-- Helpers -------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Tables --------------------------------------------------------------------

create table public.users (
  id uuid primary key default gen_random_uuid(),
  role public.user_role not null,
  display_name text not null check (length(btrim(display_name)) between 1 and 80),
  paypal_email text check (
    paypal_email is null
    or paypal_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ),
  is_demo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_seller_needs_paypal_email
    check (role <> 'seller' or paypal_email is not null)
);

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.users (id) on delete restrict,
  buyer_id uuid not null references public.users (id) on delete restrict,
  title text not null check (length(btrim(title)) between 1 and 140),
  description text not null default '',
  price_cents integer not null check (price_cents between 1000 and 10000),
  currency text not null default 'USD' check (currency = 'USD'),
  listing_image_path text,
  state public.deal_state not null default 'AWAITING_PAYMENT',
  delivery_estimate_days integer check (delivery_estimate_days between 1 and 14),
  shipped_at timestamptz,
  auto_release_at timestamptz,
  carrier text,
  tracking_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deals_distinct_parties check (seller_id <> buyer_id)
);

create index deals_seller_id_idx on public.deals (seller_id);
create index deals_buyer_id_idx on public.deals (buyer_id);
create index deals_state_idx on public.deals (state);
create index deals_auto_release_idx on public.deals (auto_release_at)
  where state = 'SHIPPED';

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  purpose public.payment_purpose not null,
  status public.payment_status not null default 'CREATED',
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'USD' check (currency = 'USD'),
  paypal_order_id text,
  paypal_capture_id text,
  paypal_payout_batch_id text,
  paypal_payout_item_id text,
  paypal_refund_id text,
  idempotency_key text not null unique
    check (length(idempotency_key) between 8 and 128),
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_one_per_purpose unique (deal_id, purpose)
);

create unique index payments_paypal_order_id_key on public.payments (paypal_order_id)
  where paypal_order_id is not null;
create unique index payments_paypal_capture_id_key on public.payments (paypal_capture_id)
  where paypal_capture_id is not null;
create unique index payments_paypal_payout_batch_id_key on public.payments (paypal_payout_batch_id)
  where paypal_payout_batch_id is not null;
create unique index payments_paypal_payout_item_id_key on public.payments (paypal_payout_item_id)
  where paypal_payout_item_id is not null;
create unique index payments_paypal_refund_id_key on public.payments (paypal_refund_id)
  where paypal_refund_id is not null;

create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  type public.evidence_type not null,
  uploaded_by uuid not null references public.users (id) on delete restrict,
  storage_path text not null unique,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes bigint not null check (size_bytes > 0),
  width integer check (width > 0),
  height integer check (height > 0),
  exif jsonb not null default '{}'::jsonb check (jsonb_typeof(exif) = 'object'),
  superseded_at timestamptz,
  created_at timestamptz not null default now()
);

create index evidence_deal_id_idx on public.evidence (deal_id);
create unique index evidence_one_current_per_type on public.evidence (deal_id, type)
  where superseded_at is null;

create table public.ai_audits (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  kind public.audit_kind not null default 'EVIDENCE_AUDIT',
  status public.audit_status not null default 'PENDING',
  model text,
  prompt_version text,
  result jsonb check (result is null or jsonb_typeof(result) = 'object'),
  inconsistencies jsonb not null default '[]'::jsonb
    check (jsonb_typeof(inconsistencies) = 'array'),
  triggered_rules text[] not null default '{}'::text[] check (
    triggered_rules <@ array[
      'PRODUCT_MISMATCH',
      'WEIGHT_OUT_OF_RANGE',
      'UNREADABLE_GUIDE',
      'CONFLICTING_EVIDENCE',
      'TECHNICAL_FAILURE',
      'OUT_OF_BAND_REVERSAL'
    ]::text[]
  ),
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ai_audits_deal_timeline_idx on public.ai_audits (deal_id, created_at desc);
create index ai_audits_pending_idx on public.ai_audits (created_at)
  where status in ('PENDING', 'RUNNING');

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals (id) on delete cascade,
  opened_by uuid not null references public.users (id) on delete restrict,
  reason text not null check (length(btrim(reason)) between 1 and 2000),
  status public.dispute_status not null default 'OPEN',
  verdict public.dispute_verdict,
  decided_by public.decider,
  mediator_note text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint disputes_decision_complete check (
    (status = 'OPEN' and verdict is null and decided_by is null and decided_at is null)
    or (status = 'DECIDED' and verdict is not null and decided_by is not null and decided_at is not null)
  )
);

create index disputes_deal_id_idx on public.disputes (deal_id);
create unique index disputes_one_open_per_deal on public.disputes (deal_id)
  where status = 'OPEN';

create table public.events (
  id bigint generated always as identity primary key,
  deal_id uuid not null references public.deals (id) on delete cascade,
  actor public.actor not null,
  from_state public.deal_state,
  to_state public.deal_state not null,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  constraint events_state_actually_changed
    check (from_state is null or from_state <> to_state)
);

create index events_deal_timeline_idx on public.events (deal_id, created_at);
-- PayPal retries the same webhook id; one event row per delivery keeps handlers idempotent.
create unique index events_webhook_event_key on public.events ((payload->>'webhookEventId'))
  where payload->>'webhookEventId' is not null;

-- updated_at triggers --------------------------------------------------------

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

create trigger deals_set_updated_at
  before update on public.deals
  for each row execute function public.set_updated_at();

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

create trigger ai_audits_set_updated_at
  before update on public.ai_audits
  for each row execute function public.set_updated_at();

create trigger disputes_set_updated_at
  before update on public.disputes
  for each row execute function public.set_updated_at();

-- Row-level security helpers -------------------------------------------------

create or replace function public.is_mediator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid() and u.role = 'mediator'
  );
$$;

create or replace function public.is_deal_party(p_deal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.deals d
    where d.id = p_deal_id
      and (d.buyer_id = auth.uid() or d.seller_id = auth.uid())
  );
$$;

create or replace function public.shares_deal_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.deals d
    where (d.buyer_id = auth.uid() and d.seller_id = p_user_id)
       or (d.seller_id = auth.uid() and d.buyer_id = p_user_id)
  );
$$;

revoke all on function public.set_updated_at() from public;
revoke all on function public.is_mediator() from public;
revoke all on function public.is_deal_party(uuid) from public;
revoke all on function public.shares_deal_with(uuid) from public;
grant execute on function public.is_mediator() to authenticated;
grant execute on function public.is_deal_party(uuid) to authenticated;
grant execute on function public.shares_deal_with(uuid) to authenticated;

alter table public.users enable row level security;
alter table public.deals enable row level security;
alter table public.payments enable row level security;
alter table public.evidence enable row level security;
alter table public.ai_audits enable row level security;
alter table public.disputes enable row level security;
alter table public.events enable row level security;

-- Writes are service-role only: no insert, update or delete policy exists below.
revoke all on public.users, public.deals, public.payments, public.evidence,
  public.ai_audits, public.disputes, public.events from anon;
revoke insert, update, delete on public.users, public.deals, public.payments,
  public.evidence, public.ai_audits, public.disputes, public.events from authenticated;
grant select on public.users, public.deals, public.payments, public.evidence,
  public.ai_audits, public.disputes, public.events to authenticated;

create policy "users read own, related parties and mediators"
  on public.users for select to authenticated
  using (id = auth.uid() or public.is_mediator() or public.shares_deal_with(id));

create policy "deals read for parties and mediators"
  on public.deals for select to authenticated
  using (public.is_deal_party(id) or public.is_mediator());

create policy "payments read for parties and mediators"
  on public.payments for select to authenticated
  using (public.is_deal_party(deal_id) or public.is_mediator());

create policy "evidence read for parties and mediators"
  on public.evidence for select to authenticated
  using (public.is_deal_party(deal_id) or public.is_mediator());

create policy "ai_audits read for parties and mediators"
  on public.ai_audits for select to authenticated
  using (public.is_deal_party(deal_id) or public.is_mediator());

create policy "disputes read for parties and mediators"
  on public.disputes for select to authenticated
  using (public.is_deal_party(deal_id) or public.is_mediator());

create policy "events read for parties and mediators"
  on public.events for select to authenticated
  using (public.is_deal_party(deal_id) or public.is_mediator());

-- Evidence bucket ------------------------------------------------------------
-- Path convention: <deal_id>/<slot>-<timestamp>.<ext>. The folder is the deal id.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'evidence',
  'evidence',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "evidence objects read for deal parties and mediators"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'evidence'
    and (
      public.is_mediator()
      or (
        (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and public.is_deal_party(((storage.foldername(name))[1])::uuid)
      )
    )
  );

create policy "evidence objects upload for deal parties"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'evidence'
    and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_deal_party(((storage.foldername(name))[1])::uuid)
  );
