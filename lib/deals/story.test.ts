import { describe, expect, it } from "vitest";
import { DEAL_STATES } from "@/lib/state-machine/states";
import {
  buyerMoneyNote,
  dealOutcome,
  missingEvidenceNote,
  showsVerificationCode,
  type StoryDeal,
} from "./story";

const deal = (changes: Partial<StoryDeal>): StoryDeal => ({
  state: "REFUNDED",
  priceCents: 8500,
  sellerName: "Diego Vargas",
  closedFrom: "REFUNDING",
  refundReason: null,
  ...changes,
});

describe("dealOutcome", () => {
  it("explains an AI refund with its reason, to each side", () => {
    const refunded = deal({ refundReason: "EVIDENCE_TIMEOUT" });
    expect(dealOutcome(refunded, "buyer")).toEqual({
      title: "You were refunded",
      body: "The seller did not send valid photos before the deadline, so the AI cancelled the deal. PayPal confirmed the refund of 85.00 USD.",
    });
    expect(dealOutcome(refunded, "seller")?.body).toMatch(/^You did not send valid photos/);
  });

  it("says a refund in progress is still with PayPal", () => {
    const outcome = dealOutcome(deal({ state: "REFUNDING", closedFrom: "AUDITING", refundReason: "DIFFERENT_ITEM" }), "buyer");
    expect(outcome?.title).toBe("You are being refunded");
    expect(outcome?.body).toContain("lands once PayPal confirms it");
  });

  it("names who decided a dispute", () => {
    expect(dealOutcome(deal({ closedFrom: "ARBITRATING" }), "buyer")?.body).toContain("upheld your dispute");
    expect(dealOutcome(deal({ closedFrom: "ESCALATED" }), "seller")?.body).toContain("A mediator");
    expect(
      dealOutcome(deal({ state: "RELEASED", closedFrom: "ARBITRATING" }), "seller")?.body,
    ).toContain("did not uphold the dispute");
  });

  it("explains an ordinary release", () => {
    expect(dealOutcome(deal({ state: "RELEASED", closedFrom: "SHIPPED" }), "buyer")).toEqual({
      title: "Diego Vargas was paid",
      body: "Paid after you confirmed receipt or the auto-release deadline passed. PayPal confirmed the payout of 85.00 USD.",
    });
  });

  it("has no outcome while the deal is open", () => {
    expect(dealOutcome(deal({ state: "SHIPPED" }), "buyer")).toBeNull();
  });
});

describe("buyerMoneyNote", () => {
  it("never says the money is held once it moved", () => {
    for (const state of ["REFUNDING", "REFUNDED", "RELEASED"] as const) {
      expect(buyerMoneyNote({ state, priceCents: 8500 })).toBeNull();
    }
  });

  it("speaks about a future hold before payment", () => {
    expect(buyerMoneyNote({ state: "AWAITING_PAYMENT", priceCents: 8500 })).toMatch(/^When you pay/);
  });

  it("covers every open state", () => {
    const open = DEAL_STATES.filter((state) => !["REFUNDING", "REFUNDED", "RELEASED"].includes(state));
    for (const state of open) {
      expect(buyerMoneyNote({ state, priceCents: 8500 })).not.toBeNull();
    }
  });
});

describe("evidence without photos", () => {
  it("says why there are no photos", () => {
    expect(missingEvidenceNote("REFUNDED")).toBe("The seller sent no photos, so no audit ran.");
    expect(missingEvidenceNote("AWAITING_PAYMENT")).toMatch(/^After you pay/);
  });

  it("shows the code only while photos are expected or on record", () => {
    expect(showsVerificationCode("FUNDS_HELD", false)).toBe(true);
    expect(showsVerificationCode("REFUNDED", false)).toBe(false);
    expect(showsVerificationCode("REFUNDED", true)).toBe(true);
    expect(showsVerificationCode("AWAITING_PAYMENT", false)).toBe(false);
  });
});
