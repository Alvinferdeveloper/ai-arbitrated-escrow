import { describe, expect, it } from "vitest";
import { formatDeadline, holdingSlipDeadline } from "./deadline";

const now = new Date("2026-10-29T12:00:00.000Z");

function inMs(ms: number): Date {
  return new Date(now.getTime() + ms);
}

describe("formatDeadline", () => {
  it("names another deadline when asked", () => {
    expect(formatDeadline(inMs(2 * 60 * 1000), now, "Evidence due")).toBe("Evidence due in 2m");
  });

  it("shows days and hours for a long deadline", () => {
    expect(formatDeadline(inMs(46 * 60 * 60 * 1000), now)).toBe("Auto-release in 1d 22h");
  });

  it("shows hours and minutes on the last day", () => {
    expect(formatDeadline(inMs(2 * 60 * 60 * 1000 + 5 * 60 * 1000), now)).toBe(
      "Auto-release in 2h 5m",
    );
  });

  it("shows minutes on the last hour", () => {
    expect(formatDeadline(inMs(9 * 60 * 1000), now)).toBe("Auto-release in 9m");
  });

  it("handles the last minute and a passed deadline", () => {
    expect(formatDeadline(inMs(30 * 1000), now)).toBe("Auto-release in under a minute");
    expect(formatDeadline(inMs(-1), now)).toBe("Auto-release deadline passed");
    expect(formatDeadline(now, now)).toBe("Auto-release deadline passed");
  });
});

describe("holdingSlipDeadline", () => {
  it("says what happens once a deadline has passed", () => {
    expect(holdingSlipDeadline({ evidenceDueAt: inMs(-1), autoReleaseAt: null }, now)).toBe(
      "Evidence deadline passed, refund starting",
    );
    expect(holdingSlipDeadline({ evidenceDueAt: null, autoReleaseAt: inMs(-1) }, now)).toBe(
      "Auto-release due, payout starting",
    );
  });

  it("prefers the evidence deadline and has none otherwise", () => {
    expect(
      holdingSlipDeadline({ evidenceDueAt: inMs(60_000), autoReleaseAt: inMs(120_000) }, now),
    ).toBe("Evidence due in 1m");
    expect(holdingSlipDeadline({ evidenceDueAt: null, autoReleaseAt: null }, now)).toBeUndefined();
  });
});
