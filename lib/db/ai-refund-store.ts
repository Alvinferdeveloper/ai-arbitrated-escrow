import "server-only";
import type { AiRefundStore } from "@/lib/state-machine/ai-refund";
import type { DealState } from "@/lib/state-machine/states";
import type {
  TransitionEvent,
  TransitionRecord,
} from "@/lib/state-machine/transition";
import { getSupabaseAdmin } from "./server";
import {
  toTransitionEvent,
  transitionRpcError,
  type TransitionRpcRow,
} from "./transition-store";

export class SupabaseAiRefundStore implements AiRefundStore {
  async startRefund(record: TransitionRecord, idempotencyKey: string): Promise<TransitionEvent> {
    const { data, error } = await getSupabaseAdmin()
      .rpc("start_ai_refund", {
        p_deal_id: record.dealId,
        p_from: record.from,
        p_actor: record.actor,
        p_payload: record.payload,
        p_idempotency_key: idempotencyKey,
      })
      .returns<TransitionRpcRow[]>()
      .single<TransitionRpcRow>();

    if (error) throw transitionRpcError(record, error);
    return toTransitionEvent(data);
  }
}

export type OverdueEvidenceDeal = {
  id: string;
  state: Extract<DealState, "FUNDS_HELD" | "EVIDENCE_REJECTED">;
};

/** Deals still waiting for valid evidence since before `before`. */
export async function listOverdueEvidenceDeals(
  before: Date,
  limit: number,
): Promise<OverdueEvidenceDeal[]> {
  // Seeded deals carry placeholder captures (DEMO-...) that PayPal cannot refund.
  const { data, error } = await getSupabaseAdmin()
    .from("deals")
    .select("id, state, payments!inner(purpose, paypal_capture_id)")
    .in("state", ["FUNDS_HELD", "EVIDENCE_REJECTED"])
    .lt("updated_at", before.toISOString())
    .eq("payments.purpose", "CAPTURE")
    .not("payments.paypal_capture_id", "is", null)
    .not("payments.paypal_capture_id", "like", "DEMO-%")
    .order("updated_at", { ascending: true })
    .limit(limit)
    .returns<OverdueEvidenceDeal[]>();

  if (error) throw new Error(`Could not list overdue evidence: ${error.message}`);
  return (data ?? []).map(({ id, state }) => ({ id, state }));
}
