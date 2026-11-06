import { describe, expect, it } from "vitest";
import { scoreCase, summarize, type EvalActual, type EvalResult } from "./score";

function actual(overrides: Partial<EvalActual>): EvalActual {
  return { outcome: "PASS", rules: [], retakeSlots: [], ...overrides };
}

describe("scoreCase", () => {
  it("accepts an honest deal that moves on", () => {
    expect(scoreCase({ outcome: "PASS" }, actual({}))).toBe("CORRECT");
    expect(scoreCase({ outcome: "RELEASE" }, actual({ outcome: "RELEASE" }))).toBe("CORRECT");
  });

  it("flags a bad deal that moves on as missed fraud", () => {
    expect(scoreCase({ outcome: "REFUND" }, actual({ outcome: "PASS" }))).toBe("MISSED_FRAUD");
    expect(scoreCase({ outcome: "ESCALATE" }, actual({ outcome: "RELEASE" }))).toBe("MISSED_FRAUD");
  });

  it("flags an honest deal that stops", () => {
    expect(scoreCase({ outcome: "PASS" }, actual({ outcome: "RETAKE" }))).toBe("HONEST_STOPPED");
    expect(scoreCase({ outcome: "RELEASE" }, actual({ outcome: "REFUND" }))).toBe("HONEST_STOPPED");
  });

  it("flags a stopped deal that took another step", () => {
    expect(scoreCase({ outcome: "REFUND" }, actual({ outcome: "RETAKE" }))).toBe("WRONG_STEP");
  });

  it("requires the expected rules and retake slots, and allows extra ones", () => {
    const expected = {
      outcome: "RETAKE",
      rules: ["WEIGHT_OUT_OF_RANGE"],
      retakeSlots: ["C"],
    } as const;

    expect(
      scoreCase(
        expected,
        actual({
          outcome: "RETAKE",
          rules: ["WEIGHT_OUT_OF_RANGE", "TRACKING_FORMAT"],
          retakeSlots: ["A", "C"],
        }),
      ),
    ).toBe("CORRECT");
    expect(
      scoreCase(expected, actual({ outcome: "RETAKE", rules: ["TRACKING_FORMAT"], retakeSlots: ["C"] })),
    ).toBe("WRONG_STEP");
    expect(
      scoreCase(expected, actual({ outcome: "RETAKE", rules: ["WEIGHT_OUT_OF_RANGE"], retakeSlots: ["A"] })),
    ).toBe("WRONG_STEP");
  });

  it("reports a technical failure apart from the model's judgment", () => {
    expect(
      scoreCase({ outcome: "PASS" }, actual({ outcome: "ESCALATE", rules: ["TECHNICAL_FAILURE"] })),
    ).toBe("TECHNICAL");
  });
});

describe("summarize", () => {
  it("counts each verdict and leaves technical failures out of the mediator count", () => {
    const results: EvalResult[] = [
      { caseId: "a", verdict: "CORRECT", expected: { outcome: "PASS" }, actual: actual({}) },
      {
        caseId: "b",
        verdict: "MISSED_FRAUD",
        expected: { outcome: "REFUND" },
        actual: actual({}),
      },
      {
        caseId: "c",
        verdict: "CORRECT",
        expected: { outcome: "ESCALATE" },
        actual: actual({ outcome: "ESCALATE", rules: ["CONFLICTING_EVIDENCE"] }),
      },
      {
        caseId: "d",
        verdict: "TECHNICAL",
        expected: { outcome: "RELEASE" },
        actual: actual({ outcome: "ESCALATE", rules: ["TECHNICAL_FAILURE"] }),
      },
    ];

    expect(summarize(results)).toEqual({
      ran: 4,
      correct: 2,
      badDeals: 2,
      missedFraud: 1,
      honestDeals: 2,
      honestStopped: 0,
      wrongStep: 0,
      technical: 1,
      sentToPerson: 1,
    });
  });
});
