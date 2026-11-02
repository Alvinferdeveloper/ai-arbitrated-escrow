import { describe, expect, it } from "vitest";
import { startAiRefund, type AiRefundStore } from "./ai-refund";
import { GuardedTransitionError, transition, type TransitionRecord } from "./transition";

function makeStore() {
  const calls: { record: TransitionRecord; key: string }[] = [];
  const store: AiRefundStore = {
    startRefund: async (record, key) => {
      calls.push({ record, key });
      return { ...record, occurredAt: new Date(0) };
    },
  };
  return { store, calls };
}

describe("startAiRefund()", () => {
  it("cancels a deal on a missed deadline as the system", async () => {
    const { store, calls } = makeStore();

    await startAiRefund(
      { dealId: "deal", from: "EVIDENCE_REJECTED", actor: "system", reason: "EVIDENCE_TIMEOUT" },
      store,
    );

    expect(calls[0].record).toMatchObject({
      from: "EVIDENCE_REJECTED",
      to: "REFUNDING",
      actor: "system",
      payload: { reason: "EVIDENCE_TIMEOUT" },
    });
    expect(calls[0].key.length).toBeLessThanOrEqual(128);
  });

  it("uses a new idempotency key for every refund", async () => {
    const { store, calls } = makeStore();
    const input = { dealId: "deal", from: "FUNDS_HELD", actor: "system", reason: "EVIDENCE_TIMEOUT" } as const;

    await startAiRefund(input, store);
    await startAiRefund(input, store);

    expect(calls[0].key).not.toBe(calls[1].key);
  });
});

describe("REFUNDING transitions", () => {
  const store = { transition: async (record: TransitionRecord) => ({ ...record, occurredAt: new Date(0) }) };

  it("lets nobody but the AI or the system cancel a deal", async () => {
    for (const actor of ["buyer", "seller", "mediator", "paypal"] as const) {
      await expect(
        transition({ dealId: "deal", from: "FUNDS_HELD", to: "REFUNDING", actor }, store),
      ).rejects.toBeInstanceOf(GuardedTransitionError);
    }
  });

  it("is settled only by PayPal", async () => {
    await expect(
      transition({ dealId: "deal", from: "REFUNDING", to: "REFUNDED", actor: "ai" }, store),
    ).rejects.toBeInstanceOf(GuardedTransitionError);

    await expect(
      transition({ dealId: "deal", from: "REFUNDING", to: "REFUNDED", actor: "paypal" }, store),
    ).resolves.toMatchObject({ to: "REFUNDED" });
  });
});
