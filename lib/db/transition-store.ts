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

type TransitionRpcRow = {
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

    if (error) {
      if (
        error.code === "40001" ||
        error.message.includes("deal_state_conflict")
      ) {
        throw new TransitionConflictError(
          record.dealId,
          record.from,
          asDealState(error.details),
        );
      }

      if (error.code === "P0002" || error.message.includes("deal_not_found")) {
        throw new DealNotFoundError(record.dealId);
      }

      throw new Error(`Supabase transition failed: ${error.message}`);
    }

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
}
