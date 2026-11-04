import { describe, expect, it } from "vitest";
import { STATE_PRESENTATION, isWaitingOnSystem, nextActionFor } from "./presentation";

describe("isWaitingOnSystem()", () => {
  it("is true only while the system moves the deal next", () => {
    expect(isWaitingOnSystem("AUDITING")).toBe(true);
    expect(isWaitingOnSystem("ARBITRATING")).toBe(true);
    expect(isWaitingOnSystem("REFUNDING")).toBe(true);
    expect(isWaitingOnSystem("AWAITING_PAYMENT")).toBe(false);
    expect(isWaitingOnSystem("ESCALATED")).toBe(false);
  });
});

describe("nextActionFor", () => {
  it("addresses the reader as you", () => {
    expect(nextActionFor("REFUNDED", "buyer")).toBe("The money was refunded to you.");
    expect(nextActionFor("RELEASED", "seller")).toBe("The money was paid to you.");
    expect(nextActionFor("SHIPPED")).toBe(STATE_PRESENTATION.SHIPPED.nextAction);
  });
});
