-- Example deals: seeded snapshots that show one step of the flow. Their
-- captures are placeholders PayPal cannot pay out or refund, so they never
-- change state and never queue a payout or refund. The guards live here so no
-- code path can move them by mistake.

alter table public.deals
  add column is_example boolean not null default false;

create or replace function public.guard_example_deal_state()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- The seed script sets app.seeding to reshape the examples.
  if old.is_example
     and new.state is distinct from old.state
     and coalesce(current_setting('app.seeding', true), '') <> 'on' then
    raise exception using errcode = '55000', message = 'example_deal';
  end if;
  return new;
end;
$$;

create trigger deals_guard_example_state
  before update of state on public.deals
  for each row execute function public.guard_example_deal_state();

create or replace function public.guard_example_deal_settlement()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.purpose in ('PAYOUT', 'REFUND') and exists (
    select 1 from public.deals as d where d.id = new.deal_id and d.is_example
  ) then
    raise exception using errcode = '55000', message = 'example_deal';
  end if;
  return new;
end;
$$;

create trigger payments_guard_example_settlement
  before insert on public.payments
  for each row execute function public.guard_example_deal_settlement();

notify pgrst, 'reload schema';
