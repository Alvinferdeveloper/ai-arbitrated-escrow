import { describe, expect, it } from "vitest";
import { isWaitingOnSystem } from "./presentation";

describe("isWaitingOnSystem()", () => {
  it("is true only while the system moves the deal next", () => {
    expect(isWaitingOnSystem("AUDITING")).toBe(true);
    expect(isWaitingOnSystem("ARBITRATING")).toBe(true);
    expect(isWaitingOnSystem("REFUNDING")).toBe(true);
    expect(isWaitingOnSystem("AWAITING_PAYMENT")).toBe(false);
    expect(isWaitingOnSystem("ESCALATED")).toBe(false);
  });
});
