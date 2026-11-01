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
  product: { matchesListing: true, expectedWeightKg: 1.4, reason: "Matches." },
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

class Store {
  state: DealState = "AUDITING";
  readonly events: TransitionEvent[] = [];
  readonly shipments: Shipment[] = [];

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
}

async function apply(decision: EvidenceAuditDecision) {
  const store = new Store();
  const event = await applyEvidenceDecision("deal", decision, {
    transitions: store,
    shipping: store,
  });
  return { event, store };
}

describe("applyEvidenceDecision()", () => {
  it("ships a passed audit with the guide tracking", async () => {
    const { store, event } = await apply({
      outcome: "PASS",
      triggeredRules: [],
      evidenceIssues: [],
      audit,
    });

    expect(store.state).toBe("SHIPPED");
    expect(event.actor).toBe("ai");
    expect(store.shipments).toEqual([
      { carrier: "UPS", trackingNumber: "1Z999AA10123456784" },
    ]);
  });

  it("rejects blocked evidence and says what is missing", async () => {
    const { store, event } = await apply({
      outcome: "BLOCK",
      triggeredRules: [],
      evidenceIssues: ["PARCEL_NOT_SEALED"],
      audit,
    });

    expect(store.state).toBe("EVIDENCE_REJECTED");
    expect(store.shipments).toHaveLength(0);
    expect(event.payload).toMatchObject({
      evidenceIssues: ["PARCEL_NOT_SEALED"],
      detail: "Photo C does not show a sealed parcel.",
    });
  });

  it("escalates with the first rule as the case reason", async () => {
    const { store, event } = await apply({
      outcome: "ESCALATE",
      triggeredRules: ["WEIGHT_OUT_OF_RANGE", "HIGH_VALUE"],
      evidenceIssues: [],
      audit: { ...audit, inconsistencies: ["The guide shows 0.4 kg."] },
    });

    expect(store.state).toBe("ESCALATED");
    expect(event.payload).toMatchObject({
      rule: "WEIGHT_OUT_OF_RANGE",
      triggeredRules: ["WEIGHT_OUT_OF_RANGE", "HIGH_VALUE"],
      reasonDetail: "The guide shows 0.4 kg.",
    });
  });

  it("explains a high-value review on clean evidence", async () => {
    const { event } = await apply({
      outcome: "ESCALATE",
      triggeredRules: ["HIGH_VALUE"],
      evidenceIssues: [],
      audit,
    });

    expect(event.payload.reasonDetail).toContain("deals this large");
  });

  it("escalates a technical failure without an audit", async () => {
    const { store, event } = await apply({
      outcome: "ESCALATE",
      triggeredRules: ["TECHNICAL_FAILURE"],
      evidenceIssues: [],
      audit: null,
      technicalError: "timeout",
    });

    expect(store.state).toBe("ESCALATED");
    expect(event.payload.rule).toBe("TECHNICAL_FAILURE");
  });
});
