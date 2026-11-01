import type { DealState } from "@/lib/state-machine/states";
import { arbitrateDispute, type ArbitrationDecision } from "./arbitration";
import type { ArbitrationImage, ArbitrationInput, ArbitrationModel } from "./ports";

// Same contract as the evidence audit job: safe to repeat, and a deal that
// already left ARBITRATING is never moved.

export type ArbitrationSubject = {
  dealState: DealState;
  /** Null when the deal has no valid evidence audit to compare against. */
  input: ArbitrationInput | null;
  images: ArbitrationImage[];
};

export interface ArbitrationJobStore {
  /** Returns null when another run owns the audit. */
  claimAudit(auditId: string): Promise<{ dealId: string } | null>;
  loadArbitrationSubject(dealId: string): Promise<ArbitrationSubject | null>;
  recordArbitration(
    auditId: string,
    decision: ArbitrationDecision,
    modelId: string | null,
  ): Promise<void>;
}

export type RunArbitrationOptions = {
  auditId: string;
  store: ArbitrationJobStore;
  getModel: () => { model: ArbitrationModel; modelId: string };
  applyDecision: (dealId: string, decision: ArbitrationDecision) => Promise<void>;
};

export type RunArbitrationResult =
  | { status: "SKIPPED"; reason: "NOT_CLAIMED" | "DEAL_NOT_ARBITRATING" | "DEAL_NOT_FOUND" }
  | { status: "DONE"; outcome: ArbitrationDecision["outcome"] };

function technicalFailure(message: string): ArbitrationDecision {
  return {
    outcome: "ESCALATE",
    triggeredRules: ["TECHNICAL_FAILURE"],
    reason: message,
    buyerAudit: null,
    sellerAudit: null,
    technicalError: message,
  };
}

export async function runArbitration({
  auditId,
  store,
  getModel,
  applyDecision,
}: RunArbitrationOptions): Promise<RunArbitrationResult> {
  const claim = await store.claimAudit(auditId);
  if (!claim) return { status: "SKIPPED", reason: "NOT_CLAIMED" };

  const subject = await store.loadArbitrationSubject(claim.dealId);

  if (!subject) {
    await store.recordArbitration(auditId, technicalFailure("The deal no longer exists"), null);
    return { status: "SKIPPED", reason: "DEAL_NOT_FOUND" };
  }

  if (subject.dealState !== "ARBITRATING") {
    await store.recordArbitration(
      auditId,
      technicalFailure(`The deal moved to ${subject.dealState} before the arbitration ran`),
      null,
    );
    return { status: "SKIPPED", reason: "DEAL_NOT_ARBITRATING" };
  }

  let decision: ArbitrationDecision;
  let modelId: string | null = null;

  if (!subject.input) {
    decision = technicalFailure("The deal has no finished evidence audit to compare against");
  } else {
    try {
      const handle = getModel();
      modelId = handle.modelId;
      decision = await arbitrateDispute({
        model: handle.model,
        input: subject.input,
        images: subject.images,
      });
    } catch (error) {
      decision = technicalFailure(
        error instanceof Error ? error.message : "The model could not be configured",
      );
    }
  }

  await store.recordArbitration(auditId, decision, modelId);
  await applyDecision(claim.dealId, decision);

  return { status: "DONE", outcome: decision.outcome };
}
