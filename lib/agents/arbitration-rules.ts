import { isWeightOutOfRange } from "./rules";
import type { EscalationRuleId } from "./rules.config";
import type { BuyerEvidenceAudit, EvidenceAudit } from "./schemas";

// Arbitration reuses the evidence thresholds, but the question is different:
// do the seller's and buyer's accounts of the same parcel agree? A disagreement
// that a rule cannot settle goes to a person; agreement can release or refund.

export const ARBITRATION_OUTCOMES = ["RELEASE", "REFUND", "ESCALATE"] as const;
export type ArbitrationOutcome = (typeof ARBITRATION_OUTCOMES)[number];

export type ArbitrationRuleInput = {
  sellerAudit: EvidenceAudit;
  buyerAudit: BuyerEvidenceAudit;
};

export type ArbitrationRuleDecision = {
  outcome: ArbitrationOutcome;
  triggeredRules: EscalationRuleId[];
  reason: string;
};

function addRule(rules: EscalationRuleId[], rule: EscalationRuleId): void {
  if (!rules.includes(rule)) rules.push(rule);
}

export function evaluateArbitrationRules({
  sellerAudit,
  buyerAudit,
}: ArbitrationRuleInput): ArbitrationRuleDecision {
  const triggeredRules: EscalationRuleId[] = [];
  const reasons: string[] = [];

  const sellerSaysMatch = sellerAudit.product.matchesListing;
  const buyerSaysMatch = buyerAudit.item.matchesListing;
  const productDisagrees = sellerSaysMatch !== buyerSaysMatch;
  const itemChanged = !buyerAudit.item.matchesSellerPhoto;

  const parcelMismatch = !buyerAudit.parcel.matchesSellerParcel;
  const sealDisagrees = sellerAudit.parcel.sealed !== buyerAudit.parcel.sealedOnArrival;
  const weightOut = isWeightOutOfRange(
    buyerAudit.recordedWeightKg,
    sellerAudit.product.expectedWeightKg,
  );

  if (productDisagrees || itemChanged) {
    addRule(triggeredRules, "PRODUCT_MISMATCH");
    reasons.push(
      itemChanged
        ? "The item in the buyer's photo does not match the seller's product photo."
        : "The seller's photos and the buyer's photos disagree about the product.",
    );
  }

  if (parcelMismatch || sealDisagrees) {
    addRule(triggeredRules, "CONFLICTING_EVIDENCE");
    reasons.push(
      parcelMismatch
        ? "The parcel in the buyer's photo does not match the seller's parcel photo."
        : "The seller and the buyer disagree about whether the parcel was sealed.",
    );
  }

  if (weightOut) {
    addRule(triggeredRules, "WEIGHT_OUT_OF_RANGE");
    reasons.push("The buyer's recorded weight is outside the expected range.");
  }

  const buyerFindingNegative =
    !buyerSaysMatch ||
    itemChanged ||
    !buyerAudit.parcel.sealedOnArrival ||
    parcelMismatch ||
    weightOut;

  // A structured verdict that contradicts the findings is not evidence; it is
  // exactly the case a mediator should read.
  if (buyerAudit.claim.supported === "SUPPORTED" && !buyerFindingNegative) {
    addRule(triggeredRules, "CONFLICTING_EVIDENCE");
    reasons.push("The buyer's verdict says the claim is supported, but the findings show no problem.");
  }

  if (buyerAudit.claim.supported === "NOT_SUPPORTED" && buyerFindingNegative) {
    addRule(triggeredRules, "CONFLICTING_EVIDENCE");
    reasons.push("The buyer's verdict says the claim is not supported, but the findings show a problem.");
  }

  if (buyerAudit.claim.supported === "UNCLEAR" && triggeredRules.length === 0) {
    addRule(triggeredRules, "CONFLICTING_EVIDENCE");
    reasons.push("The buyer's evidence is not clear enough to settle the dispute.");
  }

  if (triggeredRules.length > 0) {
    return {
      outcome: "ESCALATE",
      triggeredRules,
      reason: reasons.join(" "),
    };
  }

  if (!sellerSaysMatch && !buyerSaysMatch) {
    return {
      outcome: "REFUND",
      triggeredRules,
      reason:
        "Both the seller's and the buyer's evidence show the item does not match the listing.",
    };
  }

  if (!sellerAudit.parcel.sealed && !buyerAudit.parcel.sealedOnArrival) {
    return {
      outcome: "REFUND",
      triggeredRules,
      reason: "Both sides' evidence shows the parcel was not sealed.",
    };
  }

  if (buyerAudit.claim.supported === "SUPPORTED") {
    return {
      outcome: "REFUND",
      triggeredRules,
      reason: "The buyer's evidence supports the claim and no escalation rule fired.",
    };
  }

  return {
    outcome: "RELEASE",
    triggeredRules,
    reason:
      "The buyer's evidence matches the listing and the parcel; the claim is not supported.",
  };
}
