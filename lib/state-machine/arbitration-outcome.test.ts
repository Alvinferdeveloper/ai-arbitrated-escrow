import { describe, expect, it } from "vitest";
import type { ArbitrationDecision } from "@/lib/agents/arbitration";
import {
  applyArbitrationDecision,
  type ArbitrationOutcomeStore,
  type QueueArbitrationSettlementInput,
} from "./arbitration-outcome";
import type { DealState } from "./states";
import {
  TransitionConflictError,
  type TransitionEvent,
  type TransitionRecord,
} from "./transition";

class Store implements ArbitrationOutcomeStore {
  state: DealState = "ARBITRATING";
  readonly events: TransitionEvent[] = [];
  readonly settlements: QueueArbitrationSettlementInput[] = [];

  async transition(record: TransitionRecord): Promise<TransitionEvent> {
    if (record.from !== this.state) {
      throw new TransitionConflictError(record.dealId, record.from, this.state);
    }
    this.state = record.to;
    const event = { ...record, occurredAt: new Date(0) };
    this.events.push(event);
    return event;
  }

  async queueArbitrationSettlement(input: QueueArbitrationSettlementInput) {
    this.settlements.push(input);
    return {
      paymentId: "payment",
      purpose: input.outcome === "RELEASE" ? ("PAYOUT" as const) : ("REFUND" as const),
      status: "PENDING" as const,
      idempotencyKey: input.idempotencyKey,
    };
  }
}

const base: Omit<ArbitrationDecision, "outcome"> = {
  triggeredRules: [],
  reason: "The buyer's photo matches the seller's.",
  buyerAudit: null,
  sellerAudit: null,
};

describe("applyArbitrationDecision()", () => {
  it("queues a payout for a release without settling the deal", async () => {
    const store = new Store();

    const result = await applyArbitrationDecision("deal", { ...base, outcome: "RELEASE" }, store);

    expect(result.status).toBe("SETTLEMENT_QUEUED");
    expect(store.state).toBe("ARBITRATING");
    expect(store.events).toHaveLength(0);
    expect(store.settlements[0]).toMatchObject({ outcome: "RELEASE" });
    expect(store.settlements[0].idempotencyKey.length).toBeLessThanOrEqual(128);
  });

  it("queues a refund without settling the deal", async () => {
    const store = new Store();

    await applyArbitrationDecision("deal", { ...base, outcome: "REFUND" }, store);

    expect(store.state).toBe("ARBITRATING");
    expect(store.settlements[0]).toMatchObject({ outcome: "REFUND" });
  });

  it("escalates a contradiction to a mediator with its rule", async () => {
    const store = new Store();

    const result = await applyArbitrationDecision(
      "deal",
      {
        ...base,
        outcome: "ESCALATE",
        triggeredRules: ["PRODUCT_MISMATCH"],
        reason: "The item in the buyer's photo does not match the seller's product photo.",
      },
      store,
    );

    expect(result.status).toBe("ESCALATED");
    expect(store.state).toBe("ESCALATED");
    expect(store.settlements).toHaveLength(0);
    expect(store.events[0]).toMatchObject({
      actor: "ai",
      payload: { rule: "PRODUCT_MISMATCH" },
    });
  });

  it("explains a technical failure in plain words", async () => {
    const store = new Store();

    await applyArbitrationDecision(
      "deal",
      {
        ...base,
        outcome: "ESCALATE",
        triggeredRules: ["TECHNICAL_FAILURE"],
        technicalError: "timeout",
      },
      store,
    );

    expect(store.events[0].payload.reasonDetail).toContain("could not finish");
  });
});
