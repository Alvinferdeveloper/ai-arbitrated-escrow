import { randomUUID } from "node:crypto";
import type { ArbitrationDecision } from "@/lib/agents/arbitration";
import type { MediationSettlement } from "./mediator";
import {
  transition,
  type DealTransitionStore,
  type TransitionEvent,
} from "./transition";

// A RELEASE or REFUND verdict only queues the settlement; the deal leaves
// ARBITRATING when PayPal's webhook confirms the money moved.

export type QueueArbitrationSettlementInput = {
  dealId: string;
  outcome: "RELEASE" | "REFUND";
  reason: string;
  idempotencyKey: string;
};

export interface ArbitrationOutcomeStore extends DealTransitionStore {
  queueArbitrationSettlement(
    input: QueueArbitrationSettlementInput,
  ): Promise<MediationSettlement>;
}

export type ArbitrationOutcomeResult =
  | { status: "ESCALATED"; event: TransitionEvent }
  | { status: "SETTLEMENT_QUEUED"; settlement: MediationSettlement };

export async function applyArbitrationDecision(
  dealId: string,
  decision: ArbitrationDecision,
  store: ArbitrationOutcomeStore,
): Promise<ArbitrationOutcomeResult> {
  if (decision.outcome === "ESCALATE") {
    const event = await transition(
      {
        dealId,
        from: "ARBITRATING",
        to: "ESCALATED",
        actor: "ai",
        payload: {
          rule: decision.triggeredRules[0] ?? "TECHNICAL_FAILURE",
          triggeredRules: decision.triggeredRules,
          reasonDetail: decision.technicalError
            ? "The arbitration could not finish. A person compares both sides instead."
            : decision.reason,
        },
      },
      store,
    );
    return { status: "ESCALATED", event };
  }

  const settlement = await store.queueArbitrationSettlement({
    dealId,
    outcome: decision.outcome,
    reason: decision.reason,
    idempotencyKey: `arbitration-${decision.outcome.toLowerCase()}-${randomUUID()}`,
  });

  return { status: "SETTLEMENT_QUEUED", settlement };
}
