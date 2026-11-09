import { describe, expect, it } from "vitest";
import {
  STATE_PRESENTATION,
  isConfirmingPayment,
  isWaitingOnSystem,
  nextActionFor,
} from "./presentation";

describe("isWaitingOnSystem()", () => {
  it("is true only while the system moves the deal next", () => {
    expect(isWaitingOnSystem("AUDITING")).toBe(true);
    expect(isWaitingOnSystem("ARBITRATING")).toBe(true);
    expect(isWaitingOnSystem("REFUNDING")).toBe(true);
    expect(isWaitingOnSystem("AWAITING_PAYMENT")).toBe(false);
    expect(isWaitingOnSystem("ESCALATED")).toBe(false);
  });
});

describe("isConfirmingPayment()", () => {
  it("is true while PayPal has the payment and the deal is still waiting for it", () => {
    expect(isConfirmingPayment("AWAITING_PAYMENT", "APPROVED")).toBe(true);
    expect(isConfirmingPayment("AWAITING_PAYMENT", "PENDING")).toBe(true);
    expect(isConfirmingPayment("AWAITING_PAYMENT", "COMPLETED")).toBe(true);
  });

  it("is false before a capture, after a failure and once the deal has moved", () => {
    expect(isConfirmingPayment("AWAITING_PAYMENT", null)).toBe(false);
    expect(isConfirmingPayment("AWAITING_PAYMENT", "CREATED")).toBe(false);
    expect(isConfirmingPayment("AWAITING_PAYMENT", "FAILED")).toBe(false);
    expect(isConfirmingPayment("FUNDS_HELD", "COMPLETED")).toBe(false);
  });
});

describe("nextActionFor", () => {
  it("addresses the reader as you", () => {
    expect(nextActionFor("REFUNDED", "buyer")).toBe("The money was refunded to you.");
    expect(nextActionFor("RELEASED", "seller")).toBe("The money was paid to you.");
    expect(nextActionFor("SHIPPED")).toBe(STATE_PRESENTATION.SHIPPED.nextAction);
  });
});
