import { describe, expect, it } from "vitest";
import { evaluateArbitrationRules, type ArbitrationRuleDecision } from "./arbitration-rules";
import type { BuyerEvidenceAudit, EvidenceAudit } from "./schemas";

const sellerAudit: EvidenceAudit = {
  product: {
    matchesListing: true,
    expectedWeightKg: 1.4,
    reason: "The black headphones match the listing.",
  },
  packing: {
    productInside: true,
    reason: "The headphones are inside the box.",
  },
  parcel: {
    sealed: true,
    guideVisible: true,
    reason: "The parcel is sealed and the guide is visible.",
  },
  guide: {
    readable: true,
    carrier: "UPS",
    trackingNumber: "1Z999AA10123456784",
    weightKg: 1.4,
    date: "2026-10-28",
  },
  inconsistencies: [],
};

const buyerAudit: BuyerEvidenceAudit = {
  item: {
    matchesListing: true,
    matchesSellerPhoto: true,
    condition: "AS_DESCRIBED",
    reason: "The same headphones arrived in the condition described.",
  },
  parcel: {
    sealedOnArrival: true,
    matchesSellerParcel: true,
    reason: "The box and tape match the seller's photo.",
  },
  recordedWeightKg: null,
  claim: {
    supported: "NOT_SUPPORTED",
    reason: "The item matches the listing and arrived as described.",
  },
  inconsistencies: [],
};

function withSeller(changes: Partial<EvidenceAudit>): EvidenceAudit {
  return { ...sellerAudit, ...changes };
}

function withBuyer(changes: Partial<BuyerEvidenceAudit>): BuyerEvidenceAudit {
  return { ...buyerAudit, ...changes };
}

function evaluate(
  seller: EvidenceAudit = sellerAudit,
  buyer: BuyerEvidenceAudit = buyerAudit,
): ArbitrationRuleDecision {
  return evaluateArbitrationRules({ sellerAudit: seller, buyerAudit: buyer });
}

describe("arbitration rules", () => {
  it("releases when the buyer's evidence is clean and the claim is not supported", () => {
    const decision = evaluate();
    expect(decision.outcome).toBe("RELEASE");
    expect(decision.triggeredRules).toEqual([]);
  });

  it("escalates when the buyer reports a different item", () => {
    const decision = evaluate(
      sellerAudit,
      withBuyer({
        item: {
          matchesListing: false,
          matchesSellerPhoto: false,
          condition: "DIFFERENT_ITEM",
          reason: "A white tablet arrived instead of the headphones.",
        },
        claim: { supported: "SUPPORTED", reason: "The item is different." },
      }),
    );

    expect(decision.outcome).toBe("ESCALATE");
    expect(decision.triggeredRules).toEqual(["PRODUCT_MISMATCH"]);
  });

  it("escalates when the item changed even if it looks like the listing", () => {
    const decision = evaluate(
      sellerAudit,
      withBuyer({
        item: {
          matchesListing: true,
          matchesSellerPhoto: false,
          condition: "AS_DESCRIBED",
          reason: "The item matches the listing but not the seller's photo.",
        },
        claim: { supported: "SUPPORTED", reason: "The item is not the one photographed." },
      }),
    );

    expect(decision.outcome).toBe("ESCALATE");
    expect(decision.triggeredRules).toContain("PRODUCT_MISMATCH");
  });

  it("refunds when both sides agree the item does not match the listing", () => {
    const decision = evaluate(
      withSeller({
        product: {
          ...sellerAudit.product,
          matchesListing: false,
          reason: "The listing shows white headphones; the photo shows black ones.",
        },
      }),
      withBuyer({
        item: {
          matchesListing: false,
          matchesSellerPhoto: true,
          condition: "DIFFERENT_ITEM",
          reason: "The arrived item is the same one the seller photographed, but not the listing.",
        },
        claim: { supported: "SUPPORTED", reason: "The item does not match the listing." },
      }),
    );

    expect(decision.outcome).toBe("REFUND");
    expect(decision.triggeredRules).toEqual([]);
  });

  it("escalates when the seller and buyer disagree about the seal", () => {
    const decision = evaluate(
      sellerAudit,
      withBuyer({
        parcel: {
          sealedOnArrival: false,
          matchesSellerParcel: true,
          reason: "The tape was already cut when the parcel arrived.",
        },
        claim: { supported: "SUPPORTED", reason: "The parcel arrived open." },
      }),
    );

    expect(decision.outcome).toBe("ESCALATE");
    expect(decision.triggeredRules).toEqual(["CONFLICTING_EVIDENCE"]);
  });

  it("escalates when the parcel does not match the seller's photo", () => {
    const decision = evaluate(
      sellerAudit,
      withBuyer({
        parcel: {
          sealedOnArrival: true,
          matchesSellerParcel: false,
          reason: "The label and tape belong to a different parcel.",
        },
        claim: { supported: "SUPPORTED", reason: "The parcel is not the one the seller sent." },
      }),
    );

    expect(decision.outcome).toBe("ESCALATE");
    expect(decision.triggeredRules).toEqual(["CONFLICTING_EVIDENCE"]);
  });

  it("escalates when the buyer's recorded weight is out of range", () => {
    const decision = evaluate(
      sellerAudit,
      withBuyer({
        recordedWeightKg: 0.4,
        claim: { supported: "SUPPORTED", reason: "The parcel was far too light." },
      }),
    );

    expect(decision.outcome).toBe("ESCALATE");
    expect(decision.triggeredRules).toEqual(["WEIGHT_OUT_OF_RANGE"]);
  });

  it("escalates a supported claim with no supporting finding", () => {
    const decision = evaluate(
      sellerAudit,
      withBuyer({
        claim: { supported: "SUPPORTED", reason: "The buyer says the item is wrong." },
      }),
    );

    expect(decision.outcome).toBe("ESCALATE");
    expect(decision.triggeredRules).toEqual(["CONFLICTING_EVIDENCE"]);
  });

  it("escalates a negative finding against a not-supported claim", () => {
    const decision = evaluate(
      withSeller({
        parcel: { ...sellerAudit.parcel, sealed: false, reason: "The parcel is open." },
      }),
      withBuyer({
        parcel: {
          sealedOnArrival: false,
          matchesSellerParcel: true,
          reason: "The parcel also arrived open.",
        },
        claim: { supported: "NOT_SUPPORTED", reason: "The buyer says there is no problem." },
      }),
    );

    expect(decision.outcome).toBe("ESCALATE");
    expect(decision.triggeredRules).toEqual(["CONFLICTING_EVIDENCE"]);
  });

  it("escalates an unclear claim when no other rule fired", () => {
    const decision = evaluate(
      sellerAudit,
      withBuyer({
        claim: { supported: "UNCLEAR", reason: "The photos are too dark to tell." },
      }),
    );

    expect(decision.outcome).toBe("ESCALATE");
    expect(decision.triggeredRules).toEqual(["CONFLICTING_EVIDENCE"]);
  });

  it("refunds when both sides agree the parcel was not sealed", () => {
    const decision = evaluate(
      withSeller({
        parcel: { ...sellerAudit.parcel, sealed: false, reason: "The parcel is open." },
      }),
      withBuyer({
        parcel: {
          sealedOnArrival: false,
          matchesSellerParcel: true,
          reason: "The parcel arrived open, as the seller's photo shows.",
        },
        claim: { supported: "SUPPORTED", reason: "The parcel was not sealed." },
      }),
    );

    expect(decision.outcome).toBe("REFUND");
    expect(decision.triggeredRules).toEqual([]);
  });

  it("escalates when the seller's own audit disagrees with a clean buyer", () => {
    const decision = evaluate(
      withSeller({
        product: {
          ...sellerAudit.product,
          matchesListing: false,
          reason: "The listing shows white headphones; the seller photo shows black ones.",
        },
      }),
    );

    expect(decision.outcome).toBe("ESCALATE");
    expect(decision.triggeredRules).toContain("PRODUCT_MISMATCH");
  });

  it("reports multiple rules once and in a stable order", () => {
    const decision = evaluate(
      sellerAudit,
      withBuyer({
        item: {
          matchesListing: true,
          matchesSellerPhoto: false,
          condition: "AS_DESCRIBED",
          reason: "The item changed in transit.",
        },
        parcel: {
          sealedOnArrival: false,
          matchesSellerParcel: false,
          reason: "A different parcel arrived open.",
        },
        recordedWeightKg: 0.4,
        claim: { supported: "SUPPORTED", reason: "The parcel and the item are wrong." },
      }),
    );

    expect(decision.outcome).toBe("ESCALATE");
    expect(decision.triggeredRules).toEqual([
      "PRODUCT_MISMATCH",
      "CONFLICTING_EVIDENCE",
      "WEIGHT_OUT_OF_RANGE",
    ]);
  });
});
