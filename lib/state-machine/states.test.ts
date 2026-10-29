import { describe, expect, it } from "vitest";
import { DEAL_STATES, FINAL_STATES, TRANSITIONS, canTransition } from "./states";

describe("deal state machine", () => {
  it("never leaves a final state", () => {
    for (const s of FINAL_STATES) expect(TRANSITIONS[s]).toHaveLength(0);
  });

  it("only targets known states", () => {
    for (const s of DEAL_STATES) {
      for (const to of TRANSITIONS[s]) expect(DEAL_STATES).toContain(to);
    }
  });

  it("cannot release before shipping", () => {
    expect(canTransition("FUNDS_HELD", "RELEASED")).toBe(false);
    expect(canTransition("SHIPPED", "RELEASED")).toBe(true);
  });
});
