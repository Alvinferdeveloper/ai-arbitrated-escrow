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
    dateIso: "2026-10-28",
  },
  verification: { codeInPhotoA: null, codeInPhotoC: null },
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
        guide: {
          readable: false,
          carrier: null,
          trackingNumber: null,
          weightKg: null,
          date: null,
          dateIso: null,
        },
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
        dateIso: "2026-10-28",
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

  describe("fraud checks", () => {
    const dealCreatedAt = new Date("2026-11-03T15:00:00Z");
    const freshAudit = withAudit({
      guide: { ...honestAudit.guide, date: "2026-11-03", dateIso: "2026-11-03" },
      verification: { codeInPhotoA: "K7P4", codeInPhotoC: "k7-p4" },
    });
    const photo = (slot: "A" | "B" | "C", changes = {}) => ({
      slot,
      exif: { DateTimeOriginal: "2026-11-03T16:00:00.000Z" },
      reusedInOtherDeal: false,
      ...changes,
    });
    const context = {
      priceCents: ORDINARY_PRICE_CENTS,
      verificationCode: "K7P4",
      freshness: { dealCreatedAt, photos: [photo("A"), photo("B"), photo("C")] },
    };

    it("passes fresh evidence with the code in photos A and C", () => {
      expect(evaluateWithContext(freshAudit, context)).toMatchObject({
        outcome: "PASS",
        triggeredRules: [],
      });
    });

    it("asks for the code in each photo where it is missing", () => {
      const decision = evaluateWithContext(
        withAudit({ ...freshAudit, verification: { codeInPhotoA: null, codeInPhotoC: "K7P4" } }),
        context,
      );
      expect(decision.outcome).toBe("RETAKE");
      expect(decision.triggeredRules).toEqual(["VERIFICATION_CODE"]);
      expect(decision.retakes).toHaveLength(1);
      expect(decision.retakes[0]).toMatchObject({ slot: "A" });
      expect(decision.retakes[0].instruction).toContain("K7P4");
    });

    it("skips the code check on deals without a code", () => {
      const decision = evaluateWithContext(
        withAudit({ ...freshAudit, verification: { codeInPhotoA: null, codeInPhotoC: null } }),
        { ...context, verificationCode: null },
      );
      expect(decision.outcome).toBe("PASS");
    });

    it("asks for a new guide when it predates the deal", () => {
      const decision = evaluateWithContext(
        withAudit({ ...freshAudit, guide: { ...freshAudit.guide, dateIso: "2026-10-20" } }),
        context,
      );
      expect(decision.triggeredRules).toEqual(["GUIDE_PREDATES_DEAL"]);
      expect(decision.retakes.map((retake) => retake.slot)).toEqual(["C"]);
    });

    it("asks for a sharper guide when the tracking number does not fit the carrier", () => {
      const decision = evaluateWithContext(
        withAudit({ ...freshAudit, guide: { ...freshAudit.guide, trackingNumber: "12345" } }),
        context,
      );
      expect(decision.triggeredRules).toEqual(["TRACKING_FORMAT"]);
      expect(decision.retakes.map((retake) => retake.slot)).toEqual(["C"]);
    });

    it("asks for new photos when they were reused, old or edited", () => {
      const decision = evaluateWithContext(freshAudit, {
        ...context,
        freshness: {
          dealCreatedAt,
          photos: [
            photo("A", { reusedInOtherDeal: true }),
            photo("B", { exif: { DateTimeOriginal: "2026-08-01T10:00:00.000Z" } }),
            photo("C", { exif: { Software: "Adobe Photoshop 25.0" } }),
          ],
        },
      });
      expect(decision.outcome).toBe("RETAKE");
      expect(decision.triggeredRules).toEqual(["REUSED_PHOTO", "OLD_PHOTO", "EDITED_PHOTO"]);
      expect(decision.retakes.map((retake) => retake.slot)).toEqual(["A", "B", "C"]);
    });

    it("skips freshness on sample deals but still checks the code", () => {
      const decision = evaluateWithContext(
        withAudit({ ...freshAudit, guide: { ...freshAudit.guide, dateIso: "2026-01-01" } }),
        { ...context, freshness: null },
      );
      expect(decision.outcome).toBe("PASS");
    });
  });
});
