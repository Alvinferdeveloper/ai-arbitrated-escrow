import type { EvidencePhotoSlot } from "@/lib/agents/ports";
import type { EscalationRuleId } from "@/lib/agents/rules.config";

// Pure scoring. The verdicts separate the mistakes by what they cost: letting
// a bad deal through loses money, stopping an honest one loses trust.

export type EvalOutcome = "PASS" | "RETAKE" | "REFUND" | "RELEASE" | "ESCALATE";

export type EvalExpectation = {
  outcome: EvalOutcome;
  /** Each of these must fire; others may fire too. */
  rules?: readonly EscalationRuleId[];
  /** Each of these must be asked for again; others may be too. */
  retakeSlots?: readonly EvidencePhotoSlot[];
};

export type EvalActual = {
  outcome: EvalOutcome;
  rules: readonly EscalationRuleId[];
  retakeSlots: readonly EvidencePhotoSlot[];
};

export type EvalVerdict =
  | "CORRECT"
  | "MISSED_FRAUD"
  | "HONEST_STOPPED"
  | "WRONG_STEP"
  | "TECHNICAL";

export type EvalResult = {
  caseId: string;
  verdict: EvalVerdict;
  expected: EvalExpectation;
  actual: EvalActual;
  detail?: string;
};

/** The deal goes on towards the seller's payout. */
function moveForward(outcome: EvalOutcome): boolean {
  return outcome === "PASS" || outcome === "RELEASE";
}

export function scoreCase(expected: EvalExpectation, actual: EvalActual): EvalVerdict {
  if (actual.rules.includes("TECHNICAL_FAILURE")) return "TECHNICAL";

  const expectedForward = moveForward(expected.outcome);
  const actualForward = moveForward(actual.outcome);

  if (!expectedForward && actualForward) return "MISSED_FRAUD";
  if (expectedForward && !actualForward) return "HONEST_STOPPED";

  const sameStep =
    expected.outcome === actual.outcome &&
    (expected.rules ?? []).every((rule) => actual.rules.includes(rule)) &&
    (expected.retakeSlots ?? []).every((slot) => actual.retakeSlots.includes(slot));

  return sameStep ? "CORRECT" : "WRONG_STEP";
}

export type EvalSummary = {
  ran: number;
  correct: number;
  /** Runs where a bad deal should have stopped. */
  badDeals: number;
  missedFraud: number;
  /** Runs where an honest deal should have moved on. */
  honestDeals: number;
  honestStopped: number;
  wrongStep: number;
  technical: number;
  /** Decisions handed to a person because the evidence conflicts. */
  sentToPerson: number;
};

export function summarize(results: readonly EvalResult[]): EvalSummary {
  const count = (verdict: EvalVerdict) =>
    results.filter((result) => result.verdict === verdict).length;
  const honestDeals = results.filter((result) => moveForward(result.expected.outcome)).length;

  return {
    ran: results.length,
    correct: count("CORRECT"),
    badDeals: results.length - honestDeals,
    missedFraud: count("MISSED_FRAUD"),
    honestDeals,
    honestStopped: count("HONEST_STOPPED"),
    wrongStep: count("WRONG_STEP"),
    technical: count("TECHNICAL"),
    sentToPerson: results.filter(
      (result) => result.actual.outcome === "ESCALATE" && result.verdict !== "TECHNICAL",
    ).length,
  };
}
