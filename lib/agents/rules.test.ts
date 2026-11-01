import { describe, expect, it } from "vitest";
import {
  evaluateEvidenceRules as evaluateWithContext,
  isHighValue,
  isWeightOutOfRange,
  missingGuideFields,
} from "./rules";
import { ESCALATION_RULES } from "./rules.config";
import type { EvidenceAudit } from "./schemas";

const ORDINARY_PRICE_CENTS = 3750;

function evaluateEvidenceRules(audit: EvidenceAudit) {
  return evaluateWithContext(audit, { priceCents: ORDINARY_PRICE_CENTS });
}

const honestAudit: EvidenceAudit = {
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

function withAudit(changes: Partial<EvidenceAudit>): EvidenceAudit {
  return { ...honestAudit, ...changes };
}

describe("evidence rules", () => {
  it("passes an honest audit with no escalation rule", () => {
    const decision = evaluateEvidenceRules(honestAudit);
    expect(decision.outcome).toBe("PASS");
    expect(decision.triggeredRules).toEqual([]);
    expect(decision.evidenceIssues).toEqual([]);
  });

  it("escalates a product mismatch", () => {
    const decision = evaluateEvidenceRules(
      withAudit({
        product: {
          ...honestAudit.product,
          matchesListing: false,
          reason: "The listing shows black headphones; photo A shows white ones.",
        },
      }),
    );
    expect(decision.outcome).toBe("ESCALATE");
    expect(decision.triggeredRules).toContain("PRODUCT_MISMATCH");
  });

  it("compares the guide weight with the expected weight at 25% tolerance", () => {
    expect(isWeightOutOfRange(1.4, 1.4)).toBe(false);
    expect(isWeightOutOfRange(1.75, 1.4)).toBe(false);
    expect(isWeightOutOfRange(1.05, 1.4)).toBe(false);
    expect(isWeightOutOfRange(1.76, 1.4)).toBe(true);
    expect(isWeightOutOfRange(1.04, 1.4)).toBe(true);
    expect(isWeightOutOfRange(null, 1.4)).toBe(false);
  });

  it("escalates a weight outside the expected range", () => {
    const decision = evaluateEvidenceRules(
      withAudit({
        guide: { ...honestAudit.guide, weightKg: 0.4 },
        product: { ...honestAudit.product, expectedWeightKg: 1.4 },
      }),
    );
    expect(decision.outcome).toBe("ESCALATE");
    expect(decision.triggeredRules).toContain("WEIGHT_OUT_OF_RANGE");
  });

  it("escalates an unreadable guide or a missing required field", () => {
    const unreadable = evaluateEvidenceRules(
      withAudit({
        guide: {
          readable: false,
          carrier: null,
          trackingNumber: null,
          weightKg: null,
          date: null,
        },
      }),
    );
    expect(unreadable.triggeredRules).toContain("UNREADABLE_GUIDE");

    const missingTracking = evaluateEvidenceRules(
      withAudit({
        guide: { ...honestAudit.guide, trackingNumber: null },
      }),
    );
    expect(missingTracking.triggeredRules).toContain("UNREADABLE_GUIDE");

    const guideNotVisible = evaluateEvidenceRules(
      withAudit({
        parcel: { ...honestAudit.parcel, guideVisible: false },
      }),
    );
    expect(guideNotVisible.triggeredRules).toContain("UNREADABLE_GUIDE");
  });

  it("lists every missing guide field", () => {
    expect(
      missingGuideFields({
        readable: true,
        carrier: null,
        trackingNumber: "1Z999AA10123456784",
        weightKg: null,
        date: "2026-10-28",
      }),
    ).toEqual(["carrier", "weightKg"]);
  });

  it("blocks instead of escalating when packing or parcel evidence is missing", () => {
    const packing = evaluateEvidenceRules(
      withAudit({
        packing: { productInside: false, reason: "Photo B shows an empty box." },
      }),
    );
    expect(packing.outcome).toBe("BLOCK");
    expect(packing.triggeredRules).toEqual([]);
    expect(packing.evidenceIssues).toEqual(["PACKING_NOT_SHOWN"]);

    const parcel = evaluateEvidenceRules(
      withAudit({
        parcel: {
          ...honestAudit.parcel,
          sealed: false,
          reason: "The tape is cut in photo C.",
        },
      }),
    );
    expect(parcel.outcome).toBe("BLOCK");
    expect(parcel.evidenceIssues).toEqual(["PARCEL_NOT_SEALED"]);

    const both = evaluateEvidenceRules(
      withAudit({
        packing: { productInside: false, reason: "Empty box." },
        parcel: { ...honestAudit.parcel, sealed: false, reason: "Open parcel." },
      }),
    );
    expect(both.outcome).toBe("BLOCK");
    expect(both.evidenceIssues).toEqual([
      "PACKING_NOT_SHOWN",
      "PARCEL_NOT_SEALED",
    ]);
  });

  it("lets escalation win over a block and keeps the evidence issues", () => {
    const decision = evaluateEvidenceRules(
      withAudit({
        product: { ...honestAudit.product, matchesListing: false, reason: "Wrong item." },
        packing: { productInside: false, reason: "Empty box." },
      }),
    );
    expect(decision.outcome).toBe("ESCALATE");
    expect(decision.evidenceIssues).toEqual(["PACKING_NOT_SHOWN"]);
  });

  it("does not treat a free-text inconsistency as an escalation on its own", () => {
    const decision = evaluateEvidenceRules(
      withAudit({ inconsistencies: ["The box has a small dent."] }),
    );
    expect(decision.outcome).toBe("PASS");
    expect(decision.triggeredRules).toEqual([]);
  });

  it("reports multiple escalation rules in a stable order", () => {
    const decision = evaluateEvidenceRules(
      withAudit({
        product: { ...honestAudit.product, matchesListing: false, reason: "Wrong item." },
        guide: { ...honestAudit.guide, weightKg: 0.4 },
        parcel: { ...honestAudit.parcel, guideVisible: false },
      }),
    );
    expect(decision.triggeredRules).toEqual([
      "PRODUCT_MISMATCH",
      "UNREADABLE_GUIDE",
      "WEIGHT_OUT_OF_RANGE",
    ]);
  });

  it("sends a high-value deal to a person even when the evidence is clean", () => {
    const threshold = ESCALATION_RULES.highValueReviewAboveCents;

    const atThreshold = evaluateWithContext(honestAudit, { priceCents: threshold });
    expect(atThreshold.outcome).toBe("PASS");
    expect(atThreshold.triggeredRules).toEqual([]);

    const above = evaluateWithContext(honestAudit, { priceCents: threshold + 1 });
    expect(above.outcome).toBe("ESCALATE");
    expect(above.triggeredRules).toEqual(["HIGH_VALUE"]);
  });

  it("keeps the other rules alongside HIGH_VALUE", () => {
    const decision = evaluateWithContext(
      withAudit({
        product: { ...honestAudit.product, matchesListing: false },
      }),
      { priceCents: 250_000 },
    );
    expect(decision.triggeredRules).toEqual(["PRODUCT_MISMATCH", "HIGH_VALUE"]);
  });

  it("counts only amounts strictly above the threshold as high value", () => {
    expect(isHighValue(50_000, 50_000)).toBe(false);
    expect(isHighValue(50_001, 50_000)).toBe(true);
  });
});
