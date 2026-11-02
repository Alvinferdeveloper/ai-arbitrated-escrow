import { describe, expect, it, vi } from "vitest";
import type { ArbitrationDecision } from "./arbitration";
import {
  runArbitration,
  type ArbitrationJobStore,
  type ArbitrationSubject,
} from "./arbitration-job";
import type { ArbitrationModel } from "./ports";
import type { BuyerEvidenceAudit, EvidenceAudit } from "./schemas";

const sellerAudit: EvidenceAudit = {
  product: { matchesListing: true, differentItem: false, identifierVisible: false, expectedWeightKg: 1.4, reason: "Matches." },
  packing: { productInside: true, reason: "Inside." },
  parcel: { sealed: true, guideVisible: true, reason: "Sealed." },
  guide: {
    readable: true,
    carrier: "UPS",
    trackingNumber: "1Z999AA10123456784",
    weightKg: 1.4,
    date: "2026-10-28",
  },
  inconsistencies: [],
};

const matchingBuyerAudit: BuyerEvidenceAudit = {
  item: {
    matchesListing: true,
    matchesSellerPhoto: true,
    condition: "AS_DESCRIBED",
    reason: "The headphones in the photo match.",
  },
  parcel: { sealedOnArrival: true, matchesSellerParcel: true, reason: "Same box and label." },
  recordedWeightKg: null,
  claim: { supported: "NOT_SUPPORTED", reason: "The item is in the box." },
  inconsistencies: [],
};

const photo = (role: "SELLER_PRODUCT" | "SELLER_PARCEL" | "BUYER_UNBOXING") => ({
  role,
  mediaType: "image/jpeg" as const,
  data: new Uint8Array([0xff, 0xd8, 0xff]),
});

const subject: ArbitrationSubject = {
  dealState: "ARBITRATING",
  input: {
    title: "Headphones",
    description: "Black",
    priceCents: 8500,
    disputeReason: "The box was empty.",
    sellerAudit,
  },
  images: [photo("SELLER_PRODUCT"), photo("SELLER_PARCEL"), photo("BUYER_UNBOXING")],
};

function makeStore(overrides: Partial<ArbitrationJobStore> = {}) {
  const recorded: ArbitrationDecision[] = [];
  const store: ArbitrationJobStore = {
    claimAudit: async () => ({ dealId: "deal" }),
    loadArbitrationSubject: async () => subject,
    recordArbitration: async (_id, decision) => {
      recorded.push(decision);
    },
    ...overrides,
  };
  return { store, recorded };
}

const model: ArbitrationModel = { arbitrateDispute: async () => matchingBuyerAudit };

describe("runArbitration()", () => {
  it("releases when the buyer's photo matches the seller's evidence", async () => {
    const { store } = makeStore();
    const applyDecision = vi.fn(async () => {});

    const result = await runArbitration({
      auditId: "audit",
      store,
      getModel: () => ({ model, modelId: "vision" }),
      applyDecision,
    });

    expect(result).toEqual({ status: "DONE", outcome: "RELEASE" });
    expect(applyDecision).toHaveBeenCalledWith("deal", expect.objectContaining({ outcome: "RELEASE" }));
  });

  it("escalates when the deal has no seller audit to compare against", async () => {
    const { store, recorded } = makeStore({
      loadArbitrationSubject: async () => ({ ...subject, input: null }),
    });
    const applyDecision = vi.fn(async () => {});

    const result = await runArbitration({
      auditId: "audit",
      store,
      getModel: () => ({ model, modelId: "vision" }),
      applyDecision,
    });

    expect(result).toEqual({ status: "DONE", outcome: "ESCALATE" });
    expect(recorded[0].triggeredRules).toEqual(["TECHNICAL_FAILURE"]);
  });

  it("never moves a deal that already left ARBITRATING", async () => {
    const { store } = makeStore({
      loadArbitrationSubject: async () => ({ ...subject, dealState: "ESCALATED" }),
    });
    const applyDecision = vi.fn(async () => {});

    const result = await runArbitration({
      auditId: "audit",
      store,
      getModel: () => ({ model, modelId: "vision" }),
      applyDecision,
    });

    expect(result).toEqual({ status: "SKIPPED", reason: "DEAL_NOT_ARBITRATING" });
    expect(applyDecision).not.toHaveBeenCalled();
  });

  it("skips an audit another run owns", async () => {
    const { store } = makeStore({ claimAudit: async () => null });
    const applyDecision = vi.fn(async () => {});

    const result = await runArbitration({
      auditId: "audit",
      store,
      getModel: () => ({ model, modelId: "vision" }),
      applyDecision,
    });

    expect(result).toEqual({ status: "SKIPPED", reason: "NOT_CLAIMED" });
  });
});
