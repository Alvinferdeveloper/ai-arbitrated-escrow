-- PayPal shipment tracking for shipped deals. Informational only: a failed
-- registration never changes the deal state, it is recorded and retried.

alter table public.deals
  add column paypal_tracker_id text,
  add column tracking_registered_at timestamptz,
  add column tracking_attempts integer not null default 0
    check (tracking_attempts >= 0),
  add column tracking_error text;

create index deals_tracking_pending_idx on public.deals (shipped_at)
  where state = 'SHIPPED' and tracking_registered_at is null;

notify pgrst, 'reload schema';
