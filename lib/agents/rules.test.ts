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

const honestAudit: EvidenceAudit = {
  product: {
    matchesListing: true,
    differentItem: false,
    identifierVisible: false,
    expectedWeightKg: 1.4,
    reason: "The black headphones match the listing.",
  },
  packing: { productInside: true, reason: "The headphones are inside the box." },
  parcel: { sealed: true, guideVisible: true, reason: "The parcel is sealed and the guide is visible." },
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

function evaluate(audit: EvidenceAudit) {
  return evaluateWithContext(audit, { priceCents: ORDINARY_PRICE_CENTS });
}

describe("evidence rules", () => {
  it("passes an honest audit", () => {
    const decision = evaluate(honestAudit);
    expect(decision.outcome).toBe("PASS");
    expect(decision.triggeredRules).toEqual([]);
    expect(decision.retakes).toEqual([]);
  });

  it("refunds right away when photo A shows another kind of product", () => {
    const decision = evaluate(
      withAudit({
        product: { ...honestAudit.product, matchesListing: false, differentItem: true },
        packing: { productInside: false, reason: "Empty box." },
      }),
    );
    expect(decision.outcome).toBe("REFUND");
    expect(decision.triggeredRules).toEqual(["PRODUCT_MISMATCH"]);
    expect(decision.retakes).toEqual([]);
  });

  it("asks for a new photo A on a minor mismatch", () => {
    const decision = evaluate(
      withAudit({ product: { ...honestAudit.product, matchesListing: false } }),
    );
    expect(decision.outcome).toBe("RETAKE");
    expect(decision.triggeredRules).toEqual(["PRODUCT_MISMATCH"]);
    expect(decision.retakes).toEqual([
      expect.objectContaining({ slot: "A", instruction: expect.stringMatching(/^Retake photo A: /) }),
    ]);
  });

  it("compares the guide weight with the expected weight at 25% tolerance", () => {
    expect(isWeightOutOfRange(1.4, 1.4)).toBe(false);
    expect(isWeightOutOfRange(1.75, 1.4)).toBe(false);
    expect(isWeightOutOfRange(1.05, 1.4)).toBe(false);
    expect(isWeightOutOfRange(1.76, 1.4)).toBe(true);
    expect(isWeightOutOfRange(1.04, 1.4)).toBe(true);
    expect(isWeightOutOfRange(null, 1.4)).toBe(false);
  });

  it("asks for a new guide photo when the weight does not fit", () => {
    const decision = evaluate(withAudit({ guide: { ...honestAudit.guide, weightKg: 0.4 } }));
    expect(decision.outcome).toBe("RETAKE");
    expect(decision.triggeredRules).toEqual(["WEIGHT_OUT_OF_RANGE"]);
    expect(decision.retakes[0]).toMatchObject({ slot: "C" });
    expect(decision.retakes[0].instruction).toContain("1.4 kg");
  });

  it("asks for a legible guide when it is unreadable, incomplete or hidden", () => {
    for (const audit of [
      withAudit({
        guide: { readable: false, carrier: null, trackingNumber: null, weightKg: null, date: null },
      }),
      withAudit({ guide: { ...honestAudit.guide, trackingNumber: null } }),
      withAudit({ parcel: { ...honestAudit.parcel, guideVisible: false } }),
    ]) {
      const decision = evaluate(audit);
      expect(decision.outcome).toBe("RETAKE");
      expect(decision.triggeredRules).toContain("UNREADABLE_GUIDE");
      expect(decision.retakes.map((retake) => retake.slot)).toEqual(["C"]);
    }
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

  it("asks for packing and seal photos without firing a rule", () => {
    const decision = evaluate(
      withAudit({
        packing: { productInside: false, reason: "Photo B shows an empty box." },
        parcel: { ...honestAudit.parcel, sealed: false, reason: "The tape is cut." },
      }),
    );
    expect(decision.outcome).toBe("RETAKE");
    expect(decision.triggeredRules).toEqual([]);
    expect(decision.retakes.map((retake) => retake.slot)).toEqual(["B", "C"]);
  });

  it("merges several requests for the same photo into one instruction", () => {
    const decision = evaluate(
      withAudit({
        parcel: { sealed: false, guideVisible: false, reason: "Open parcel, no label." },
        guide: { ...honestAudit.guide, weightKg: 0.4 },
      }),
    );
    expect(decision.retakes).toHaveLength(1);
    expect(decision.retakes[0].instruction).toContain("sealed");
    expect(decision.retakes[0].instruction).toContain("legible");
    expect(decision.triggeredRules).toEqual(["UNREADABLE_GUIDE", "WEIGHT_OUT_OF_RANGE"]);
  });

  it("does not act on a free-text inconsistency on its own", () => {
    const decision = evaluate(withAudit({ inconsistencies: ["The box has a small dent."] }));
    expect(decision.outcome).toBe("PASS");
  });

  it("asks a high-value deal for a legible serial number", () => {
    const threshold = ESCALATION_RULES.highValueReviewAboveCents;

    const atThreshold = evaluateWithContext(honestAudit, { priceCents: threshold });
    expect(atThreshold.outcome).toBe("PASS");

    const above = evaluateWithContext(honestAudit, { priceCents: threshold + 1 });
    expect(above.outcome).toBe("RETAKE");
    expect(above.triggeredRules).toEqual(["HIGH_VALUE"]);
    expect(above.retakes[0]).toMatchObject({ slot: "A" });
    expect(above.retakes[0].instruction).toContain("serial number");

    const withSerial = evaluateWithContext(
      withAudit({ product: { ...honestAudit.product, identifierVisible: true } }),
      { priceCents: threshold + 1 },
    );
    expect(withSerial.outcome).toBe("PASS");
  });

  it("counts only amounts strictly above the threshold as high value", () => {
    expect(isHighValue(50_000, 50_000)).toBe(false);
    expect(isHighValue(50_001, 50_000)).toBe(true);
  });
});
