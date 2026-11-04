import { describe, expect, it, vi } from "vitest";
import type { EvidenceAuditDecision } from "./audit";
import {
  runEvidenceAudit,
  type AuditSubject,
  type EvidenceAuditJobStore,
} from "./evidence-audit-job";
import type { VisionModel } from "./ports";
import type { EvidenceAudit } from "./schemas";

const audit: EvidenceAudit = {
  product: { matchesListing: true, differentItem: false, identifierVisible: false, expectedWeightKg: 1.4, reason: "Matches." },
  packing: { productInside: true, reason: "Inside." },
  parcel: { sealed: true, guideVisible: true, reason: "Sealed." },
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

const image = (slot: "A" | "B" | "C") => ({
  slot,
  mediaType: "image/jpeg" as const,
  data: new Uint8Array([0xff, 0xd8, 0xff]),
});

const subject: AuditSubject = {
  dealState: "AUDITING",
  input: { title: "Headphones", description: "Black", priceCents: 3750 },
  images: [image("A"), image("B"), image("C")],
  context: { priceCents: 3750 },
};

function makeStore(overrides: Partial<EvidenceAuditJobStore> = {}) {
  const recorded: { decision: EvidenceAuditDecision; modelId: string | null }[] = [];
  const store: EvidenceAuditJobStore = {
    claimAudit: async () => ({ dealId: "deal" }),
    loadAuditSubject: async () => subject,
    recordAudit: async (_auditId, decision, modelId) => {
      recorded.push({ decision, modelId });
    },
    ...overrides,
  };
  return { store, recorded };
}

const passingModel: VisionModel = { auditEvidence: async () => audit };

describe("runEvidenceAudit()", () => {
  it("records the audit and applies the decision", async () => {
    const { store, recorded } = makeStore();
    const applyDecision = vi.fn(async () => {});

    const result = await runEvidenceAudit({
      auditId: "audit",
      store,
      getModel: () => ({ model: passingModel, modelId: "vision-model" }),
      applyDecision,
    });

    expect(result).toEqual({ status: "DONE", outcome: "PASS" });
    expect(recorded[0].modelId).toBe("vision-model");
    expect(applyDecision).toHaveBeenCalledWith(
      "deal",
      expect.objectContaining({ outcome: "PASS" }),
    );
  });

  it("does nothing when another run owns the audit", async () => {
    const { store } = makeStore({ claimAudit: async () => null });
    const applyDecision = vi.fn(async () => {});

    const result = await runEvidenceAudit({
      auditId: "audit",
      store,
      getModel: () => ({ model: passingModel, modelId: "m" }),
      applyDecision,
    });

    expect(result).toEqual({ status: "SKIPPED", reason: "NOT_CLAIMED" });
    expect(applyDecision).not.toHaveBeenCalled();
  });

  it("never moves a deal that already left AUDITING", async () => {
    const { store, recorded } = makeStore({
      loadAuditSubject: async () => ({ ...subject, dealState: "ESCALATED" }),
    });
    const applyDecision = vi.fn(async () => {});

    const result = await runEvidenceAudit({
      auditId: "audit",
      store,
      getModel: () => ({ model: passingModel, modelId: "m" }),
      applyDecision,
    });

    expect(result).toEqual({ status: "SKIPPED", reason: "DEAL_NOT_AUDITING" });
    expect(recorded[0].decision.triggeredRules).toEqual(["TECHNICAL_FAILURE"]);
    expect(applyDecision).not.toHaveBeenCalled();
  });

  it("escalates when the model is not configured", async () => {
    const { store, recorded } = makeStore();
    const applyDecision = vi.fn(async () => {});

    const result = await runEvidenceAudit({
      auditId: "audit",
      store,
      getModel: () => {
        throw new Error("AI_MODEL is not set");
      },
      applyDecision,
    });

    expect(result).toEqual({ status: "DONE", outcome: "ESCALATE" });
    expect(recorded[0]).toMatchObject({
      modelId: null,
      decision: {
        triggeredRules: ["TECHNICAL_FAILURE"],
        technicalError: "AI_MODEL is not set",
      },
    });
    expect(applyDecision).toHaveBeenCalledOnce();
  });
});
