import { describe, expect, it, vi } from "vitest";
import { arbitrateDispute } from "./arbitration";
import type { ArbitrationImage, ArbitrationInput, ArbitrationModel } from "./ports";
import type { BuyerEvidenceAudit, EvidenceAudit } from "./schemas";

const sellerAudit: EvidenceAudit = {
  product: {
    matchesListing: true,
    differentItem: false,
    identifierVisible: false,
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

const input: ArbitrationInput = {
  title: "Sony WH-1000XM4 headphones",
  description: "Used for a year, includes the case.",
  priceCents: 3750,
  disputeReason: "The buyer says the box arrived empty.",
  sellerAudit,
};

const images: readonly ArbitrationImage[] = [
  {
    role: "SELLER_PRODUCT",
    mediaType: "image/jpeg",
    data: new URL("https://example.test/seller-a.jpg"),
  },
  {
    role: "SELLER_PARCEL",
    mediaType: "image/jpeg",
    data: new URL("https://example.test/seller-c.jpg"),
  },
  {
    role: "BUYER_UNBOXING",
    mediaType: "image/jpeg",
    data: new URL("https://example.test/buyer-d.jpg"),
  },
];

function modelReturning(result: unknown): ArbitrationModel {
  return { arbitrateDispute: vi.fn(async () => result) };
}

describe("arbitrateDispute", () => {
  it("validates the model output and applies the rules", async () => {
    const decision = await arbitrateDispute({
      model: modelReturning(buyerAudit),
      input,
      images,
    });

    expect(decision.outcome).toBe("RELEASE");
    expect(decision.triggeredRules).toEqual([]);
    expect(decision.buyerAudit).toEqual(buyerAudit);
    expect(decision.sellerAudit).toEqual(sellerAudit);
    expect(decision.technicalError).toBeUndefined();
  });

  it("escalates a product mismatch", async () => {
    const decision = await arbitrateDispute({
      model: modelReturning({
        ...buyerAudit,
        item: {
          matchesListing: false,
          matchesSellerPhoto: false,
          condition: "DIFFERENT_ITEM",
          reason: "A tablet arrived instead of the headphones.",
        },
        claim: { supported: "SUPPORTED", reason: "The item is different." },
      }),
      input,
      images,
    });

    expect(decision.outcome).toBe("ESCALATE");
    expect(decision.triggeredRules).toEqual(["PRODUCT_MISMATCH"]);
  });

  it("escalates when the model returns an invalid object", async () => {
    const decision = await arbitrateDispute({
      model: modelReturning({ ...buyerAudit, item: { matchesListing: true } }),
      input,
      images,
    });

    expect(decision.outcome).toBe("ESCALATE");
    expect(decision.triggeredRules).toEqual(["TECHNICAL_FAILURE"]);
    expect(decision.buyerAudit).toBeNull();
    expect(decision.technicalError).toBeTruthy();
  });

  it("escalates when the model throws", async () => {
    const model: ArbitrationModel = {
      arbitrateDispute: vi.fn(async () => {
        throw new Error("provider unavailable");
      }),
    };
    const decision = await arbitrateDispute({ model, input, images });

    expect(decision.outcome).toBe("ESCALATE");
    expect(decision.triggeredRules).toEqual(["TECHNICAL_FAILURE"]);
    expect(decision.technicalError).toBe("provider unavailable");
  });

  it("escalates on timeout", async () => {
    const model: ArbitrationModel = {
      arbitrateDispute: vi.fn(() => new Promise<never>(() => undefined)),
    };
    const decision = await arbitrateDispute({
      model,
      input,
      images,
      timeoutMs: 10,
    });

    expect(decision.outcome).toBe("ESCALATE");
    expect(decision.triggeredRules).toEqual(["TECHNICAL_FAILURE"]);
    expect(decision.technicalError).toContain("timed out");
  });

  it("refuses to call the model without both seller photos and one buyer photo", async () => {
    const arbitrate = vi.fn(async () => buyerAudit);
    const decision = await arbitrateDispute({
      model: { arbitrateDispute: arbitrate },
      input,
      images: images.filter((image) => image.role !== "SELLER_PARCEL"),
    });

    expect(decision.triggeredRules).toEqual(["TECHNICAL_FAILURE"]);
    expect(decision.technicalError).toContain("required");
    expect(arbitrate).not.toHaveBeenCalled();
  });

  it("refuses to call the model without a buyer unboxing photo", async () => {
    const arbitrate = vi.fn(async () => buyerAudit);
    const decision = await arbitrateDispute({
      model: { arbitrateDispute: arbitrate },
      input,
      images: images.filter((image) => image.role !== "BUYER_UNBOXING"),
    });

    expect(decision.triggeredRules).toEqual(["TECHNICAL_FAILURE"]);
    expect(arbitrate).not.toHaveBeenCalled();
  });

  it("rejects an invalid stored seller audit before calling the model", async () => {
    const arbitrate = vi.fn(async () => buyerAudit);
    const invalidSeller = {
      ...sellerAudit,
      product: { ...sellerAudit.product, expectedWeightKg: 0 },
    } as unknown as EvidenceAudit;

    const decision = await arbitrateDispute({
      model: { arbitrateDispute: arbitrate },
      input: { ...input, sellerAudit: invalidSeller },
      images,
    });

    expect(decision.triggeredRules).toEqual(["TECHNICAL_FAILURE"]);
    expect(decision.sellerAudit).toBeNull();
    expect(arbitrate).not.toHaveBeenCalled();
  });
});
