import { describe, expect, it } from "vitest";
import { compareCaseAge, formatCaseAge } from "./age";

const now = new Date("2026-10-29T12:00:00.000Z");

describe("compareCaseAge()", () => {
  it("sorts by elapsed time, not by the displayed text", () => {
    const opened = (minutesAgo: number) =>
      new Date(now.getTime() - minutesAgo * 60_000).toISOString();
    const cases = [opened(10), opened(2), opened(180), opened(1500)];

    expect([...cases].sort(compareCaseAge)).toEqual([
      opened(2),
      opened(10),
      opened(180),
      opened(1500),
    ]);
  });
});

describe("formatCaseAge()", () => {
  it("shows just now for a fresh case", () => {
    expect(formatCaseAge(now, now)).toBe("just now");
  });

  it("shows minutes under an hour", () => {
    expect(formatCaseAge(new Date("2026-10-29T11:52:00.000Z"), now)).toBe("8m");
  });

  it("shows hours under a day", () => {
    expect(formatCaseAge(new Date("2026-10-29T08:00:00.000Z"), now)).toBe("4h");
  });

  it("shows days and leftover hours", () => {
    expect(formatCaseAge(new Date("2026-10-28T08:00:00.000Z"), now)).toBe("1d 4h");
  });

  it("never counts a future timestamp as negative", () => {
    expect(formatCaseAge(new Date("2026-10-29T13:00:00.000Z"), now)).toBe("just now");
  });
});
