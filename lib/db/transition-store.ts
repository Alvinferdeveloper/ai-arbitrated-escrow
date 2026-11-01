import "server-only";
import {
  DealNotFoundError,
  TransitionConflictError,
  type DealTransitionStore,
  type JsonObject,
  type TransitionEvent,
  type TransitionRecord,
} from "@/lib/state-machine/transition";
import { DEAL_STATES, type Actor, type DealState } from "@/lib/state-machine/states";
import { getSupabaseAdmin } from "./server";

export type TransitionRpcRow = {
  event_id: number;
  deal_id: string;
  from_state: DealState;
  to_state: DealState;
  actor: Actor;
  payload: JsonObject;
  created_at: string;
};

function asDealState(value: string | null | undefined): DealState | null {
  if (!value) return null;
  return DEAL_STATES.includes(value as DealState) ? (value as DealState) : null;
}

type RpcError = { code?: string; message: string; details?: string | null };

/** Maps the error codes shared by transition_deal and ship_deal. */
export function transitionRpcError(record: TransitionRecord, error: RpcError): Error {
  if (error.code === "40001" || error.message.includes("deal_state_conflict")) {
    return new TransitionConflictError(
      record.dealId,
      record.from,
      asDealState(error.details),
    );
  }

  if (error.code === "P0002" || error.message.includes("deal_not_found")) {
    return new DealNotFoundError(record.dealId);
  }

  return new Error(`Supabase transition failed: ${error.message}`);
}

export function toTransitionEvent(data: TransitionRpcRow | null): TransitionEvent {
  if (!data) {
    throw new Error("Supabase transition returned no event");
  }

  return {
    dealId: data.deal_id,
    from: data.from_state,
    to: data.to_state,
    actor: data.actor,
    payload: data.payload ?? {},
    occurredAt: new Date(data.created_at),
  };
}

/**
 * Supabase implementation of the state machine store. The RPC locks the deal
 * and appends the event in one transaction; this class only maps errors and
 * row shapes into the domain types.
 */
export class SupabaseTransitionStore implements DealTransitionStore {
  async transition(record: TransitionRecord): Promise<TransitionEvent> {
    const { data, error } = await getSupabaseAdmin()
      .rpc("transition_deal", {
        p_deal_id: record.dealId,
        p_from: record.from,
        p_to: record.to,
        p_actor: record.actor,
        p_payload: record.payload,
      })
      .returns<TransitionRpcRow[]>()
      .single<TransitionRpcRow>();

    if (error) throw transitionRpcError(record, error);

    return toTransitionEvent(data);
  }
}
