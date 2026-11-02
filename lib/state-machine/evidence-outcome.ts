import type { EvidenceAuditDecision } from "@/lib/agents/audit";
import { ESCALATION_RULES } from "@/lib/agents/rules.config";
import { startAiRefund, type AiRefundStore } from "./ai-refund";
import { shipDeal, type ShippingStore } from "./shipping";
import {
  transition,
  type DealTransitionStore,
  type TransitionEvent,
} from "./transition";

// Maps an audit outcome to the next deal state. The AI ships, asks for
// specific retakes, or refunds; only a technical failure reaches a person.

export type EvidenceOutcomeStores = {
  transitions: DealTransitionStore;
  shipping: ShippingStore;
  refunds: AiRefundStore;
};

export type EvidenceOutcomeContext = {
  /** Rejected uploads since the deal last entered FUNDS_HELD. */
  previousRejections: number;
};

export function applyEvidenceDecision(
  dealId: string,
  decision: EvidenceAuditDecision,
  stores: EvidenceOutcomeStores,
  { previousRejections }: EvidenceOutcomeContext,
): Promise<TransitionEvent> {
  if (decision.outcome === "PASS") {
    return shipDeal(
      {
        dealId,
        from: "AUDITING",
        actor: "ai",
        shipment: {
          carrier: decision.audit?.guide.carrier ?? null,
          trackingNumber: decision.audit?.guide.trackingNumber ?? null,
        },
        payload: {
          title: "Evidence passed",
          detail: "The audit cleared photos A, B and C and read the shipping guide.",
        },
      },
      stores.shipping,
    );
  }

  if (decision.outcome === "REFUND") {
    return startAiRefund(
      { dealId, from: "AUDITING", actor: "ai", reason: "DIFFERENT_ITEM" },
      stores.refunds,
    );
  }

  if (decision.outcome === "RETAKE") {
    const attempt = previousRejections + 1;

    if (attempt >= ESCALATION_RULES.maxEvidenceAttempts) {
      return startAiRefund(
        { dealId, from: "AUDITING", actor: "ai", reason: "ATTEMPTS_EXHAUSTED" },
        stores.refunds,
      );
    }

    return transition(
      {
        dealId,
        from: "AUDITING",
        to: "EVIDENCE_REJECTED",
        actor: "ai",
        payload: {
          retakes: decision.retakes,
          triggeredRules: decision.triggeredRules,
          attempt,
          attemptsLeft: ESCALATION_RULES.maxEvidenceAttempts - attempt,
          detail: decision.retakes.map((retake) => retake.instruction).join(" "),
        },
      },
      stores.transitions,
    );
  }

  return transition(
    {
      dealId,
      from: "AUDITING",
      to: "ESCALATED",
      actor: "ai",
      payload: {
        rule: "TECHNICAL_FAILURE",
        triggeredRules: decision.triggeredRules,
        reasonDetail: "The evidence audit failed twice. A person reviews the photos instead.",
      },
    },
    stores.transitions,
  );
}
