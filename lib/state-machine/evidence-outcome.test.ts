import { describe, expect, it } from "vitest";
import type { EvidenceAuditDecision } from "@/lib/agents/audit";
import type { EvidenceAudit } from "@/lib/agents/schemas";
import { applyEvidenceDecision } from "./evidence-outcome";
import type { Shipment } from "./shipping";
import type { DealState } from "./states";
import {
  TransitionConflictError,
  type TransitionEvent,
  type TransitionRecord,
} from "./transition";

const audit: EvidenceAudit = {
  product: {
    matchesListing: true,
    differentItem: false,
    identifierVisible: false,
    expectedWeightKg: 1.4,
    reason: "Matches.",
  },
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

class Store {
  state: DealState = "AUDITING";
  readonly events: TransitionEvent[] = [];
  readonly shipments: Shipment[] = [];
  readonly refundKeys: string[] = [];

  async transition(record: TransitionRecord): Promise<TransitionEvent> {
    if (record.from !== this.state) {
      throw new TransitionConflictError(record.dealId, record.from, this.state);
    }
    this.state = record.to;
    const event = { ...record, occurredAt: new Date(0) };
    this.events.push(event);
    return event;
  }

  async ship(record: TransitionRecord, shipment: Shipment): Promise<TransitionEvent> {
    this.shipments.push(shipment);
    return this.transition(record);
  }

  async startRefund(record: TransitionRecord, idempotencyKey: string): Promise<TransitionEvent> {
    this.refundKeys.push(idempotencyKey);
    return this.transition(record);
  }
}

async function apply(decision: EvidenceAuditDecision, previousRejections = 0) {
  const store = new Store();
  const event = await applyEvidenceDecision(
    "deal",
    decision,
    { transitions: store, shipping: store, refunds: store },
    { previousRejections },
  );
  return { event, store };
}

const retake: EvidenceAuditDecision = {
  outcome: "RETAKE",
  triggeredRules: ["WEIGHT_OUT_OF_RANGE"],
  retakes: [{ slot: "C", instruction: "Retake photo C: weigh the parcel again." }],
  audit,
};

describe("applyEvidenceDecision()", () => {
  it("ships a passed audit with the guide tracking", async () => {
    const { store, event } = await apply({ outcome: "PASS", triggeredRules: [], retakes: [], audit });

    expect(store.state).toBe("SHIPPED");
    expect(event.actor).toBe("ai");
    expect(store.shipments).toEqual([{ carrier: "UPS", trackingNumber: "1Z999AA10123456784" }]);
  });

  it("asks for specific retakes and counts the attempt", async () => {
    const { store, event } = await apply(retake);

    expect(store.state).toBe("EVIDENCE_REJECTED");
    expect(store.refundKeys).toHaveLength(0);
    expect(event.payload).toMatchObject({
      retakes: retake.retakes,
      attempt: 1,
      attemptsLeft: 2,
      detail: "Retake photo C: weigh the parcel again.",
    });
  });

  it("refunds instead of asking again on the last attempt", async () => {
    const { store, event } = await apply(retake, 2);

    expect(store.state).toBe("REFUNDING");
    expect(event.payload.reason).toBe("ATTEMPTS_EXHAUSTED");
    expect(store.refundKeys[0]).toMatch(/^ai-refund-/);
  });

  it("refunds a different item without a retake", async () => {
    const { store, event } = await apply({
      outcome: "REFUND",
      triggeredRules: ["PRODUCT_MISMATCH"],
      retakes: [],
      audit,
    });

    expect(store.state).toBe("REFUNDING");
    expect(event).toMatchObject({ actor: "ai", payload: { reason: "DIFFERENT_ITEM" } });
  });

  it("sends only a technical failure to a person", async () => {
    const { store, event } = await apply({
      outcome: "ESCALATE",
      triggeredRules: ["TECHNICAL_FAILURE"],
      retakes: [],
      audit: null,
      technicalError: "timeout",
    });

    expect(store.state).toBe("ESCALATED");
    expect(event.payload.rule).toBe("TECHNICAL_FAILURE");
  });
});
