-- Tells open screens that a deal changed state, over a public Realtime
-- broadcast channel per deal (deal:<id>). The message carries only the new
-- state; screens re-read everything else from the server. A broadcast failure
-- must never block the state change, so errors are swallowed.

create or replace function public.broadcast_deal_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform realtime.send(
      jsonb_build_object('state', new.to_state),
      'state',
      'deal:' || new.deal_id::text,
      false
    );
  exception when others then
    null;
  end;
  return new;
end;
$$;

revoke all on function public.broadcast_deal_state() from public;

drop trigger if exists events_broadcast_deal_state on public.events;
create trigger events_broadcast_deal_state
  after insert on public.events
  for each row execute function public.broadcast_deal_state();
