import {
  type ArbitrationImage,
  type ArbitrationInput,
  type ArbitrationModel,
} from "./ports";
import {
  evaluateArbitrationRules,
  type ArbitrationOutcome,
} from "./arbitration-rules";
import { ESCALATION_RULES, type EscalationRuleId } from "./rules.config";
import {
  buyerEvidenceSchema,
  evidenceAuditSchema,
  type BuyerEvidenceAudit,
  type EvidenceAudit,
} from "./schemas";
import { withTimeout } from "./timeout";

// One dispute comparison: the seller's stored audit plus both sides' photos
// become a validated buyer audit, then the rules choose release, refund or a
// mediator. A decision is not a payment: the state machine still has to start
// the guarded PayPal action, and only its webhook settles the deal. No error
// anywhere in this path can release money.

export type ArbitrationDecision = {
  outcome: ArbitrationOutcome;
  triggeredRules: EscalationRuleId[];
  reason: string;
  buyerAudit: BuyerEvidenceAudit | null;
  sellerAudit: EvidenceAudit | null;
  technicalError?: string;
};

export type ArbitrateDisputeOptions = {
  model: ArbitrationModel;
  input: ArbitrationInput;
  images: readonly ArbitrationImage[];
  timeoutMs?: number;
};

function technicalFailure(
  message: string,
  sellerAudit: EvidenceAudit | null,
): ArbitrationDecision {
  return {
    outcome: "ESCALATE",
    triggeredRules: ["TECHNICAL_FAILURE"],
    reason: message,
    buyerAudit: null,
    sellerAudit,
    technicalError: message,
  };
}

function hasRequiredImages(images: readonly ArbitrationImage[]): boolean {
  return (
    images.some((image) => image.role === "SELLER_PRODUCT") &&
    images.some((image) => image.role === "SELLER_PARCEL") &&
    images.some((image) => image.role === "BUYER_UNBOXING")
  );
}

export async function arbitrateDispute({
  model,
  input,
  images,
  timeoutMs = ESCALATION_RULES.auditTimeoutMs,
}: ArbitrateDisputeOptions): Promise<ArbitrationDecision> {
  const seller = evidenceAuditSchema.safeParse(input.sellerAudit);
  if (!seller.success) {
    return technicalFailure("The seller audit is invalid", null);
  }

  if (!hasRequiredImages(images)) {
    return technicalFailure(
      "The seller product, seller parcel and buyer unboxing photos are required",
      seller.data,
    );
  }

  try {
    const raw = await withTimeout(
      (signal) =>
        model.arbitrateDispute(
          { ...input, sellerAudit: seller.data },
          images,
          signal,
        ),
      timeoutMs,
    );

    const buyer = buyerEvidenceSchema.safeParse(raw);
    if (!buyer.success) {
      return technicalFailure("The model returned invalid arbitration data", seller.data);
    }

    const decision = evaluateArbitrationRules({
      sellerAudit: seller.data,
      buyerAudit: buyer.data,
    });

    return {
      ...decision,
      buyerAudit: buyer.data,
      sellerAudit: seller.data,
    };
  } catch (error) {
    return technicalFailure(
      error instanceof Error ? error.message : "The dispute arbitration failed",
      seller.data,
    );
  }
}
