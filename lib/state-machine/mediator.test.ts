import { describe, expect, it } from "vitest";
import type { Shipment } from "./shipping";
import type { DealState } from "./states";
import {
  submitMediatorDecision,
  type MediationSettlement,
  type MediatorDecisionStore,
  type QueueSettlementInput,
} from "./mediator";
import {
  TransitionConflictError,
  type TransitionEvent,
  type TransitionRecord,
} from "./transition";

class InMemoryMediatorStore implements MediatorDecisionStore {
  private state: DealState;
  readonly events: TransitionEvent[] = [];
  readonly settlements: QueueSettlementInput[] = [];
  readonly shipments: Shipment[] = [];

  constructor(state: DealState = "ESCALATED") {
    this.state = state;
  }

  stateOf(): DealState {
    return this.state;
  }

  async transition(record: TransitionRecord): Promise<TransitionEvent> {
    if (this.state !== record.from) {
      throw new TransitionConflictError(record.dealId, record.from, this.state);
    }

    this.state = record.to;
    const event: TransitionEvent = {
      ...record,
      occurredAt: new Date("2026-10-29T12:00:00.000Z"),
    };
    this.events.push(event);
    return event;
  }

  async ship(record: TransitionRecord, shipment: Shipment): Promise<TransitionEvent> {
    const event = await this.transition(record);
    this.shipments.push(shipment);
    return event;
  }

  async auditedShipment(): Promise<Shipment> {
    return { carrier: "UPS", trackingNumber: "1Z999AA10123456784" };
  }

  async queueSettlement(
    input: QueueSettlementInput,
  ): Promise<MediationSettlement> {
    this.settlements.push(input);
    return {
      paymentId: "payment-id",
      purpose: input.action === "RELEASE" ? "PAYOUT" : "REFUND",
      status: "PENDING",
      idempotencyKey: input.idempotencyKey,
    };
  }
}

describe("submitMediatorDecision()", () => {
  it("returns an escalated deal to the seller for more evidence", async () => {
    const store = new InMemoryMediatorStore();

    const result = await submitMediatorDecision(
      {
        dealId: "deal-1",
        action: "REQUEST_EVIDENCE",
        target: "SELLER",
        note: "Show the serial number in the next photo.",
      },
      store,
    );

    expect(store.stateOf()).toBe("FUNDS_HELD");
    expect(store.settlements).toHaveLength(0);
    expect(result.status).toBe("EVIDENCE_REQUESTED");
    expect(store.events[0]).toMatchObject({
      dealId: "deal-1",
      from: "ESCALATED",
      to: "FUNDS_HELD",
      actor: "mediator",
      payload: {
        decision: "REQUEST_EVIDENCE",
        target: "SELLER",
        note: "Show the serial number in the next photo.",
      },
    });
  });

  it("returns an escalated deal to the buyer for unboxing evidence", async () => {
    const store = new InMemoryMediatorStore();

    await submitMediatorDecision(
      { dealId: "deal-2", action: "REQUEST_EVIDENCE", target: "BUYER" },
      store,
    );

    expect(store.stateOf()).toBe("DISPUTED");
    expect(store.events[0].to).toBe("DISPUTED");
    expect(store.events[0].payload).not.toHaveProperty("note");
  });

  it("queues a payout without settling the deal", async () => {
    const store = new InMemoryMediatorStore();

    const result = await submitMediatorDecision(
      { dealId: "deal-3", action: "RELEASE", note: "Evidence matches." },
      store,
    );

    expect(store.stateOf()).toBe("ESCALATED");
    expect(store.events).toHaveLength(0);
    expect(store.settlements).toHaveLength(1);
    expect(store.settlements[0]).toMatchObject({
      dealId: "deal-3",
      action: "RELEASE",
      note: "Evidence matches.",
    });
    expect(result.status).toBe("SETTLEMENT_QUEUED");
    expect(result.status === "SETTLEMENT_QUEUED" && result.settlement.purpose).toBe(
      "PAYOUT",
    );
  });

  it("queues a refund with a unique idempotency key inside the column limit", async () => {
    const store = new InMemoryMediatorStore();

    await submitMediatorDecision({ dealId: "deal-4", action: "REFUND" }, store);
    await submitMediatorDecision({ dealId: "deal-5", action: "REFUND" }, store);

    const [first, second] = store.settlements;
    expect(store.settlements[0].action).toBe("REFUND");
    expect(first.idempotencyKey).not.toBe(second.idempotencyKey);
    expect(first.idempotencyKey.length).toBeGreaterThanOrEqual(8);
    expect(first.idempotencyKey.length).toBeLessThanOrEqual(128);
  });

  it("approves shipping with the tracking from the audit", async () => {
    const store = new InMemoryMediatorStore();

    const result = await submitMediatorDecision(
      { dealId: "deal-7", action: "APPROVE_SHIPPING", note: "Serial matches." },
      store,
    );

    expect(result.status).toBe("SHIPPING_APPROVED");
    expect(store.stateOf()).toBe("SHIPPED");
    expect(store.settlements).toHaveLength(0);
    expect(store.shipments).toEqual([
      { carrier: "UPS", trackingNumber: "1Z999AA10123456784" },
    ]);
    expect(store.events[0]).toMatchObject({
      from: "ESCALATED",
      to: "SHIPPED",
      actor: "mediator",
      payload: { decision: "APPROVE_SHIPPING", note: "Serial matches." },
    });
  });

  it("does not approve shipping for a deal that is no longer escalated", async () => {
    const store = new InMemoryMediatorStore("REFUNDED");

    await expect(
      submitMediatorDecision({ dealId: "deal-8", action: "APPROVE_SHIPPING" }, store),
    ).rejects.toBeInstanceOf(TransitionConflictError);
    expect(store.shipments).toHaveLength(0);
  });

  it("does not accept a decision for a deal that is no longer escalated", async () => {
    const store = new InMemoryMediatorStore("SHIPPED");

    await expect(
      submitMediatorDecision(
        { dealId: "deal-6", action: "REQUEST_EVIDENCE", target: "SELLER" },
        store,
      ),
    ).rejects.toBeInstanceOf(TransitionConflictError);
  });
});
