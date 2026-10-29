import { describe, expect, it, vi } from "vitest";
import { auditEvidence } from "./audit";
import type { EvidenceImage, VisionModel } from "./ports";
import type { EvidenceAudit } from "./schemas";

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

const input = {
  title: "Sony WH-1000XM4 headphones",
  description: "Used for a year, includes the case.",
  priceCents: 3750,
};

const images: readonly EvidenceImage[] = [
  { slot: "A", mediaType: "image/jpeg", data: new URL("https://example.test/a.jpg") },
  { slot: "B", mediaType: "image/jpeg", data: new URL("https://example.test/b.jpg") },
  { slot: "C", mediaType: "image/jpeg", data: new URL("https://example.test/c.jpg") },
];

function modelReturning(result: unknown): VisionModel {
  return { auditEvidence: vi.fn(async () => result) };
}

describe("auditEvidence", () => {
  it("validates the model output and applies the rules", async () => {
    const decision = await auditEvidence({
      model: modelReturning(honestAudit),
      input,
      images,
    });

    expect(decision.outcome).toBe("PASS");
    expect(decision.triggeredRules).toEqual([]);
    expect(decision.audit).toEqual(honestAudit);
    expect(decision.technicalError).toBeUndefined();
  });

  it("escalates when the model returns an invalid object", async () => {
    const invalid = { ...honestAudit, product: { ...honestAudit.product, reason: "" } };
    const decision = await auditEvidence({
      model: modelReturning(invalid),
      input,
      images,
    });

    expect(decision.outcome).toBe("ESCALATE");
    expect(decision.triggeredRules).toEqual(["TECHNICAL_FAILURE"]);
    expect(decision.audit).toBeNull();
    expect(decision.technicalError).toBeTruthy();
  });

  it("escalates when the model throws", async () => {
    const model: VisionModel = {
      auditEvidence: vi.fn(async () => {
        throw new Error("provider unavailable");
      }),
    };
    const decision = await auditEvidence({ model, input, images });

    expect(decision.outcome).toBe("ESCALATE");
    expect(decision.triggeredRules).toEqual(["TECHNICAL_FAILURE"]);
    expect(decision.technicalError).toBe("provider unavailable");
  });

  it("escalates on timeout without waiting for the model", async () => {
    const model: VisionModel = {
      auditEvidence: vi.fn(() => new Promise<never>(() => undefined)),
    };
    const decision = await auditEvidence({
      model,
      input,
      images,
      timeoutMs: 10,
    });

    expect(decision.outcome).toBe("ESCALATE");
    expect(decision.triggeredRules).toEqual(["TECHNICAL_FAILURE"]);
    expect(decision.technicalError).toContain("timed out");
  });

  it("refuses to call the model without photos A, B and C", async () => {
    const audit = vi.fn(async () => honestAudit);
    const decision = await auditEvidence({
      model: { auditEvidence: audit },
      input,
      images: images.slice(0, 2),
    });

    expect(decision.outcome).toBe("ESCALATE");
    expect(decision.triggeredRules).toEqual(["TECHNICAL_FAILURE"]);
    expect(audit).not.toHaveBeenCalled();
  });

  it("rejects duplicate photo slots even when three images are present", async () => {
    const audit = vi.fn(async () => honestAudit);
    const decision = await auditEvidence({
      model: { auditEvidence: audit },
      input,
      images: [images[0], images[0], images[2]],
    });

    expect(decision.triggeredRules).toEqual(["TECHNICAL_FAILURE"]);
    expect(audit).not.toHaveBeenCalled();
  });
});
