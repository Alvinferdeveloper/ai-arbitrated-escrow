import { describe, expect, it } from "vitest";
import {
  DEAL_STATES,
  TRANSITIONS,
  type Actor,
  type DealState,
} from "./states";
import {
  GuardedTransitionError,
  InvalidTransitionError,
  TransitionConflictError,
  transition,
  type DealTransitionStore,
  type TransitionEvent,
  type TransitionRecord,
} from "./transition";

class InMemoryStore implements DealTransitionStore {
  private readonly states = new Map<string, DealState>();
  readonly events: TransitionEvent[] = [];

  constructor(initial: Record<string, DealState>) {
    for (const [dealId, state] of Object.entries(initial)) {
      this.states.set(dealId, state);
    }
  }

  stateOf(dealId: string): DealState | null {
    return this.states.get(dealId) ?? null;
  }

  async transition(record: TransitionRecord): Promise<TransitionEvent> {
    const actual = this.stateOf(record.dealId);
    if (actual !== record.from) {
      throw new TransitionConflictError(record.dealId, record.from, actual);
    }

    this.states.set(record.dealId, record.to);
    const event: TransitionEvent = {
      ...record,
      occurredAt: new Date("2026-10-29T12:00:00.000Z"),
    };
    this.events.push(event);
    return event;
  }
}

function actorFor(from: DealState, to: DealState): Actor {
  if (to === "RELEASED" || to === "REFUNDED") return "paypal";
  if (from === "AWAITING_PAYMENT" && to === "FUNDS_HELD") return "paypal";
  if (to === "SHIPPED") return from === "AUDITING" ? "ai" : "mediator";
  if (to === "AUDITING") return "seller";
  return "system";
}

describe("transition()", () => {
  it("accepts every transition in the table and records one event", async () => {
    for (const from of DEAL_STATES) {
      for (const to of TRANSITIONS[from]) {
        const store = new InMemoryStore({ deal: from });
        const event = await transition(
          { dealId: "deal", from, to, actor: actorFor(from, to) },
          store,
        );

        expect(store.stateOf("deal")).toBe(to);
        expect(store.events).toHaveLength(1);
        expect(event).toMatchObject({ dealId: "deal", from, to });
      }
    }
  });

  it("rejects every pair that is not in the table", async () => {
    for (const from of DEAL_STATES) {
      for (const to of DEAL_STATES) {
        if (TRANSITIONS[from].includes(to)) continue;

        const store = new InMemoryStore({ deal: from });
        await expect(
          transition({ dealId: "deal", from, to, actor: "system" }, store),
        ).rejects.toBeInstanceOf(InvalidTransitionError);

        expect(store.stateOf("deal")).toBe(from);
        expect(store.events).toHaveLength(0);
      }
    }
  });

  it("lets only PayPal settle a deal as released or refunded", async () => {
    for (const [from, to] of [
      ["SHIPPED", "RELEASED"],
      ["ARBITRATING", "REFUNDED"],
      ["ESCALATED", "RELEASED"],
    ] as const) {
      for (const actor of ["buyer", "seller", "mediator", "ai", "system"] as const) {
        const store = new InMemoryStore({ deal: from });
        await expect(
          transition({ dealId: "deal", from, to, actor }, store),
        ).rejects.toBeInstanceOf(GuardedTransitionError);
        expect(store.events).toHaveLength(0);
      }
    }
  });

  it("lets only PayPal confirm the incoming capture", async () => {
    const store = new InMemoryStore({ deal: "AWAITING_PAYMENT" });
    await expect(
      transition(
        {
          dealId: "deal",
          from: "AWAITING_PAYMENT",
          to: "FUNDS_HELD",
          actor: "system",
        },
        store,
      ),
    ).rejects.toBeInstanceOf(GuardedTransitionError);
    expect(store.events).toHaveLength(0);
  });

  it("starts shipping only from a passed audit or a mediator", async () => {
    for (const [from, allowed] of [
      ["AUDITING", "ai"],
      ["ESCALATED", "mediator"],
    ] as const) {
      for (const actor of ["buyer", "seller", "mediator", "ai", "system", "paypal"] as const) {
        if (actor === allowed) continue;

        const store = new InMemoryStore({ deal: from });
        await expect(
          transition({ dealId: "deal", from, to: "SHIPPED", actor }, store),
        ).rejects.toBeInstanceOf(GuardedTransitionError);
        expect(store.events).toHaveLength(0);
      }

      const store = new InMemoryStore({ deal: from });
      await transition({ dealId: "deal", from, to: "SHIPPED", actor: allowed }, store);
      expect(store.stateOf("deal")).toBe("SHIPPED");
    }
  });

  it("reports a conflict when the deal moved since the caller read it", async () => {
    const store = new InMemoryStore({ deal: "SHIPPED" });
    await expect(
      transition(
        { dealId: "deal", from: "FUNDS_HELD", to: "AUDITING", actor: "seller" },
        store,
      ),
    ).rejects.toBeInstanceOf(TransitionConflictError);
    expect(store.stateOf("deal")).toBe("SHIPPED");
    expect(store.events).toHaveLength(0);
  });

  it("defaults the payload to an empty object and forwards a custom one", async () => {
    const store = new InMemoryStore({ deal: "FUNDS_HELD" });
    const withoutPayload = await transition(
      { dealId: "deal", from: "FUNDS_HELD", to: "AUDITING", actor: "seller" },
      store,
    );
    expect(withoutPayload.payload).toEqual({});

    const withPayload = await transition(
      {
        dealId: "deal",
        from: "AUDITING",
        to: "SHIPPED",
        actor: "ai",
        payload: { trackingNumber: "1Z999AA10123456784" },
      },
      store,
    );
    expect(withPayload.payload).toEqual({
      trackingNumber: "1Z999AA10123456784",
    });
    expect(store.events).toHaveLength(2);
  });
});
