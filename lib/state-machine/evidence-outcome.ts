import type { EvidenceAuditDecision } from "@/lib/agents/audit";
import { ESCALATION_RULE_LABELS } from "@/lib/agents/rules.config";
import type { EvidenceIssue } from "@/lib/agents/rules";
import { shipDeal, type ShippingStore } from "./shipping";
import {
  transition,
  type DealTransitionStore,
  type TransitionEvent,
} from "./transition";

// Maps an audit outcome to the next deal state. No money moves here.

const ISSUE_COPY: Record<EvidenceIssue, string> = {
  PACKING_NOT_SHOWN: "Photo B does not show the product inside the packing.",
  PARCEL_NOT_SEALED: "Photo C does not show a sealed parcel.",
};

export function evidenceIssueCopy(issue: EvidenceIssue): string {
  return ISSUE_COPY[issue];
}

function escalationDetail(decision: EvidenceAuditDecision): string {
  const [rule] = decision.triggeredRules;

  if (rule === "TECHNICAL_FAILURE") {
    return "The evidence audit could not finish. A person reviews the photos instead.";
  }

  if (rule === "HIGH_VALUE" && decision.triggeredRules.length === 1) {
    return "The evidence passed, but deals this large get a person's review before shipping.";
  }

  const firstInconsistency = decision.audit?.inconsistencies[0];
  if (firstInconsistency) return firstInconsistency;

  return `${rule ? ESCALATION_RULE_LABELS[rule] : "A rule"} sent this case to a person.`;
}

export type EvidenceOutcomeStores = {
  transitions: DealTransitionStore;
  shipping: ShippingStore;
};

export function applyEvidenceDecision(
  dealId: string,
  decision: EvidenceAuditDecision,
  stores: EvidenceOutcomeStores,
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

  if (decision.outcome === "BLOCK") {
    return transition(
      {
        dealId,
        from: "AUDITING",
        to: "EVIDENCE_REJECTED",
        actor: "ai",
        payload: {
          evidenceIssues: decision.evidenceIssues,
          detail: decision.evidenceIssues.map(evidenceIssueCopy).join(" "),
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
        rule: decision.triggeredRules[0] ?? "TECHNICAL_FAILURE",
        triggeredRules: decision.triggeredRules,
        reasonDetail: escalationDetail(decision),
      },
    },
    stores.transitions,
  );
}
