import {
  ESCALATION_RULES,
  type EscalationRuleId,
} from "./rules.config";
import type { EvidenceAudit } from "./schemas";

// Pure rules. The model reports findings; this file decides whether the deal
// ships, is blocked for a re-upload, or goes to the human mediator.

export const EVIDENCE_OUTCOMES = ["PASS", "BLOCK", "ESCALATE"] as const;
export type EvidenceOutcome = (typeof EVIDENCE_OUTCOMES)[number];

export const EVIDENCE_ISSUES = [
  "PACKING_NOT_SHOWN",
  "PARCEL_NOT_SEALED",
] as const;
export type EvidenceIssue = (typeof EVIDENCE_ISSUES)[number];

export type EvidenceRuleDecision = {
  outcome: EvidenceOutcome;
  triggeredRules: EscalationRuleId[];
  evidenceIssues: EvidenceIssue[];
  audit: EvidenceAudit;
};

/**
 * The tolerance is relative to the expected weight. Exactly 25% is still
 * inside the range; anything beyond it fires the rule.
 */
export function isWeightOutOfRange(
  recordedKg: number | null,
  expectedKg: number,
  tolerance = ESCALATION_RULES.weightTolerance,
): boolean {
  if (recordedKg === null || expectedKg <= 0) return false;

  // 1.75 kg against 1.4 kg is exactly 25%, but binary floating point can make
  // the division 0.25000000000000006. Keep the boundary inclusive.
  const deviation = Math.abs(recordedKg - expectedKg) / expectedKg;
  return deviation > tolerance + 1e-9;
}

export function missingGuideFields(guide: EvidenceAudit["guide"]): string[] {
  if (!guide.readable) return [...ESCALATION_RULES.requiredGuideFields];

  return ESCALATION_RULES.requiredGuideFields.filter((field) => guide[field] === null);
}

export type EvidenceRuleContext = {
  priceCents: number;
};

export function isHighValue(
  priceCents: number,
  thresholdCents = ESCALATION_RULES.highValueReviewAboveCents,
): boolean {
  return priceCents > thresholdCents;
}

export function evaluateEvidenceRules(
  audit: EvidenceAudit,
  context: EvidenceRuleContext,
): EvidenceRuleDecision {
  // CONFLICTING_EVIDENCE belongs to arbitration, where buyer and seller photos
  // can contradict each other. Before shipping there is no second side, so the
  // model's inconsistency list is shown in the report but does not fire it.
  const triggeredRules: EscalationRuleId[] = [];

  if (!audit.product.matchesListing) {
    triggeredRules.push("PRODUCT_MISMATCH");
  }

  // A guide that is not visible cannot be read either. Both cases go to a
  // mediator because the seller's proof is incomplete at the source.
  if (!audit.parcel.guideVisible || missingGuideFields(audit.guide).length > 0) {
    triggeredRules.push("UNREADABLE_GUIDE");
  }

  if (isWeightOutOfRange(audit.guide.weightKg, audit.product.expectedWeightKg)) {
    triggeredRules.push("WEIGHT_OUT_OF_RANGE");
  }

  if (isHighValue(context.priceCents)) {
    triggeredRules.push("HIGH_VALUE");
  }

  const evidenceIssues: EvidenceIssue[] = [];
  if (!audit.packing.productInside) evidenceIssues.push("PACKING_NOT_SHOWN");
  if (!audit.parcel.sealed) evidenceIssues.push("PARCEL_NOT_SEALED");

  const outcome: EvidenceOutcome =
    triggeredRules.length > 0 ? "ESCALATE" : evidenceIssues.length > 0 ? "BLOCK" : "PASS";

  return { outcome, triggeredRules, evidenceIssues, audit };
}
