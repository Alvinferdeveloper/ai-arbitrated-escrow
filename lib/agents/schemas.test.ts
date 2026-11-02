import { describe, expect, it } from "vitest";
import {
  buyerEvidenceSchema,
  evidenceAuditSchema,
  storedEvidenceAuditSchema,
} from "./schemas";

const validAudit = {
  product: {
    matchesListing: true,
    differentItem: false,
    identifierVisible: false,
    expectedWeightKg: 1.4,
    reason: "The black headphones match the model in the listing.",
  },
  packing: {
    productInside: true,
    reason: "The same headphones are inside the box.",
  },
  parcel: {
    sealed: true,
    guideVisible: true,
    reason: "The parcel is closed and the guide is in the frame.",
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

describe("evidence audit schema", () => {
  it("accepts a complete audit", () => {
    const result = evidenceAuditSchema.parse(validAudit);
    expect(result.guide.carrier).toBe("UPS");
    expect(result.inconsistencies).toEqual([]);
  });

  it("accepts null guide fields when the guide is unreadable", () => {
    const result = evidenceAuditSchema.safeParse({
      ...validAudit,
      guide: {
        readable: false,
        carrier: null,
        trackingNumber: null,
        weightKg: null,
        date: null,
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects extra keys at the root and inside a nested object", () => {
    expect(
      evidenceAuditSchema.safeParse({ ...validAudit, confidence: 0.99 }).success,
    ).toBe(false);
    expect(
      evidenceAuditSchema.safeParse({
        ...validAudit,
        product: { ...validAudit.product, verdict: "release" },
      }).success,
    ).toBe(false);
  });

  it("rejects non-positive or non-finite weights", () => {
    for (const expectedWeightKg of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(
        evidenceAuditSchema.safeParse({
          ...validAudit,
          product: { ...validAudit.product, expectedWeightKg },
        }).success,
      ).toBe(false);
    }
    for (const weightKg of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(
        evidenceAuditSchema.safeParse({
          ...validAudit,
          guide: { ...validAudit.guide, weightKg },
        }).success,
      ).toBe(false);
    }
  });

  it("rejects empty reasons and more than ten inconsistencies", () => {
    expect(
      evidenceAuditSchema.safeParse({
        ...validAudit,
        product: { ...validAudit.product, reason: "   " },
      }).success,
    ).toBe(false);

    expect(
      evidenceAuditSchema.safeParse({
        ...validAudit,
        inconsistencies: Array.from({ length: 11 }, (_, index) => `Issue ${index}`),
      }).success,
    ).toBe(false);
  });

  it("rejects an audit with a missing required guide field", () => {
    const guide = {
      readable: true,
      carrier: "UPS",
      weightKg: 1.4,
      date: "2026-10-28",
    };
    expect(evidenceAuditSchema.safeParse({ ...validAudit, guide }).success).toBe(false);
  });
});

const validBuyerAudit = {
  item: {
    matchesListing: true,
    matchesSellerPhoto: true,
    condition: "AS_DESCRIBED",
    reason: "The same black headphones arrive in the condition described.",
  },
  parcel: {
    sealedOnArrival: true,
    matchesSellerParcel: true,
    reason: "The box, tape and label match the seller's parcel photo.",
  },
  recordedWeightKg: null,
  claim: {
    supported: "NOT_SUPPORTED",
    reason: "The item matches the listing and arrived as described.",
  },
  inconsistencies: [],
};

describe("buyer evidence schema", () => {
  it("accepts a complete buyer audit", () => {
    const result = buyerEvidenceSchema.parse(validBuyerAudit);
    expect(result.item.condition).toBe("AS_DESCRIBED");
    expect(result.recordedWeightKg).toBeNull();
  });

  it("accepts a recorded weight and a supported claim", () => {
    const result = buyerEvidenceSchema.safeParse({
      ...validBuyerAudit,
      recordedWeightKg: 1.4,
      claim: { supported: "SUPPORTED", reason: "The parcel arrived open." },
    });
    expect(result.success).toBe(true);
  });

  it("rejects extra keys", () => {
    expect(
      buyerEvidenceSchema.safeParse({ ...validBuyerAudit, confidence: 0.9 }).success,
    ).toBe(false);
    expect(
      buyerEvidenceSchema.safeParse({
        ...validBuyerAudit,
        item: { ...validBuyerAudit.item, verdict: "refund" },
      }).success,
    ).toBe(false);
  });

  it("keeps the condition consistent with matchesListing", () => {
    expect(
      buyerEvidenceSchema.safeParse({
        ...validBuyerAudit,
        item: { ...validBuyerAudit.item, condition: "DAMAGED" },
      }).success,
    ).toBe(false);

    expect(
      buyerEvidenceSchema.safeParse({
        ...validBuyerAudit,
        item: {
          ...validBuyerAudit.item,
          matchesListing: false,
          condition: "AS_DESCRIBED",
        },
      }).success,
    ).toBe(false);
  });

  it("rejects unknown conditions and claims", () => {
    expect(
      buyerEvidenceSchema.safeParse({
        ...validBuyerAudit,
        item: { ...validBuyerAudit.item, condition: "STOLEN" },
      }).success,
    ).toBe(false);
    expect(
      buyerEvidenceSchema.safeParse({
        ...validBuyerAudit,
        claim: { supported: "MAYBE", reason: "Not sure." },
      }).success,
    ).toBe(false);
  });

  it("rejects non-positive weights and too many inconsistencies", () => {
    for (const recordedWeightKg of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(
        buyerEvidenceSchema.safeParse({
          ...validBuyerAudit,
          recordedWeightKg,
        }).success,
      ).toBe(false);
    }

    expect(
      buyerEvidenceSchema.safeParse({
        ...validBuyerAudit,
        inconsistencies: Array.from({ length: 11 }, (_, index) => `Issue ${index}`),
      }).success,
    ).toBe(false);
  });
});

describe("evidence audit schema, new findings", () => {
  it("rejects a different item that also matches the listing", () => {
    const result = evidenceAuditSchema.safeParse({
      ...validAudit,
      product: { ...validAudit.product, differentItem: true },
    });
    expect(result.success).toBe(false);
  });

  it("reads audits stored before the new fields existed", () => {
    const legacyProduct = { matchesListing: true, expectedWeightKg: 1.4, reason: "Matches." };
    const result = storedEvidenceAuditSchema.safeParse({ ...validAudit, product: legacyProduct });
    expect(result.success).toBe(true);
    expect(result.success && result.data.product.differentItem).toBe(false);
  });
});
