import type { EvidencePhotoSlot } from "./ports";
import {
  ESCALATION_RULES,
  type EscalationRuleId,
} from "./rules.config";
import type { EvidenceAudit } from "./schemas";

// Pure rules. The model reports findings; this file decides whether the deal
// ships, the seller retakes specific photos, or the buyer is refunded.
// ESCALATE is reserved for technical failures, set by the audit itself.

export const EVIDENCE_OUTCOMES = ["PASS", "RETAKE", "REFUND", "ESCALATE"] as const;
export type EvidenceOutcome = (typeof EVIDENCE_OUTCOMES)[number];

export type RetakeRequest = {
  slot: EvidencePhotoSlot;
  instruction: string;
};

export type EvidenceRuleDecision = {
  outcome: EvidenceOutcome;
  triggeredRules: EscalationRuleId[];
  retakes: RetakeRequest[];
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

export function isHighValue(
  priceCents: number,
  thresholdCents = ESCALATION_RULES.highValueReviewAboveCents,
): boolean {
  return priceCents > thresholdCents;
}

export type EvidenceRuleContext = {
  priceCents: number;
};

function addRule(rules: EscalationRuleId[], rule: EscalationRuleId): void {
  if (!rules.includes(rule)) rules.push(rule);
}

export function evaluateEvidenceRules(
  audit: EvidenceAudit,
  context: EvidenceRuleContext,
): EvidenceRuleDecision {
  const triggeredRules: EscalationRuleId[] = [];

  // Another kind of product altogether cannot be fixed with a better photo.
  if (audit.product.differentItem) {
    return { outcome: "REFUND", triggeredRules: ["PRODUCT_MISMATCH"], retakes: [], audit };
  }

  const instructions: Record<EvidencePhotoSlot, string[]> = { A: [], B: [], C: [] };

  if (!audit.product.matchesListing) {
    addRule(triggeredRules, "PRODUCT_MISMATCH");
    instructions.A.push("show the exact product from the listing, so its model, color and condition can be compared");
  }

  if (isHighValue(context.priceCents) && !audit.product.identifierVisible) {
    addRule(triggeredRules, "HIGH_VALUE");
    instructions.A.push("make the serial number or model label legible, as this deal is high value");
  }

  if (!audit.packing.productInside) {
    instructions.B.push("show the product inside the open box");
  }

  if (!audit.parcel.sealed) {
    instructions.C.push("show the parcel closed and sealed with tape");
  }

  if (!audit.parcel.guideVisible || missingGuideFields(audit.guide).length > 0) {
    addRule(triggeredRules, "UNREADABLE_GUIDE");
    instructions.C.push("make the carrier, tracking number, weight and date on the guide fully legible");
  }

  if (isWeightOutOfRange(audit.guide.weightKg, audit.product.expectedWeightKg)) {
    addRule(triggeredRules, "WEIGHT_OUT_OF_RANGE");
    instructions.C.push(
      `the guide weight does not fit this product (about ${audit.product.expectedWeightKg} kg packed); weigh the parcel again and show the corrected guide`,
    );
  }

  const retakes: RetakeRequest[] = (Object.keys(instructions) as EvidencePhotoSlot[])
    .filter((slot) => instructions[slot].length > 0)
    .map((slot) => ({
      slot,
      instruction: `Retake photo ${slot}: ${instructions[slot].join("; ")}.`,
    }));

  return {
    outcome: retakes.length > 0 ? "RETAKE" : "PASS",
    triggeredRules,
    retakes,
    audit,
  };
}
