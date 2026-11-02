import type { DealState } from "@/lib/state-machine/states";
import { auditEvidence, type EvidenceAuditDecision } from "./audit";
import type { EvidenceAuditInput, EvidenceImage, VisionModel } from "./ports";

// Safe to repeat: the claim is atomic and a deal that left AUDITING is never moved.

export type AuditSubject = {
  dealState: DealState;
  input: EvidenceAuditInput;
  images: EvidenceImage[];
};

export interface EvidenceAuditJobStore {
  /** Returns null when another run owns the audit. */
  claimAudit(auditId: string): Promise<{ dealId: string } | null>;
  loadAuditSubject(dealId: string): Promise<AuditSubject | null>;
  recordAudit(
    auditId: string,
    decision: EvidenceAuditDecision,
    modelId: string | null,
  ): Promise<void>;
}

export type ModelHandle = { model: VisionModel; modelId: string };

export type RunEvidenceAuditOptions = {
  auditId: string;
  store: EvidenceAuditJobStore;
  /** Lazy, so a missing provider config becomes a technical failure. */
  getModel: () => ModelHandle;
  applyDecision: (dealId: string, decision: EvidenceAuditDecision) => Promise<void>;
};

export type RunEvidenceAuditResult =
  | { status: "SKIPPED"; reason: "NOT_CLAIMED" | "DEAL_NOT_AUDITING" | "DEAL_NOT_FOUND" }
  | { status: "DONE"; outcome: EvidenceAuditDecision["outcome"] };

function technicalFailure(message: string): EvidenceAuditDecision {
  return {
    outcome: "ESCALATE",
    triggeredRules: ["TECHNICAL_FAILURE"],
    retakes: [],
    audit: null,
    technicalError: message,
  };
}

export async function runEvidenceAudit({
  auditId,
  store,
  getModel,
  applyDecision,
}: RunEvidenceAuditOptions): Promise<RunEvidenceAuditResult> {
  const claim = await store.claimAudit(auditId);
  if (!claim) return { status: "SKIPPED", reason: "NOT_CLAIMED" };

  const subject = await store.loadAuditSubject(claim.dealId);

  if (!subject) {
    await store.recordAudit(auditId, technicalFailure("The deal no longer exists"), null);
    return { status: "SKIPPED", reason: "DEAL_NOT_FOUND" };
  }

  // A stale audit must never overwrite a newer decision.
  if (subject.dealState !== "AUDITING") {
    await store.recordAudit(
      auditId,
      technicalFailure(`The deal moved to ${subject.dealState} before the audit ran`),
      null,
    );
    return { status: "SKIPPED", reason: "DEAL_NOT_AUDITING" };
  }

  let decision: EvidenceAuditDecision;
  let modelId: string | null = null;

  try {
    const handle = getModel();
    modelId = handle.modelId;
    decision = await auditEvidence({
      model: handle.model,
      input: subject.input,
      images: subject.images,
    });
  } catch (error) {
    decision = technicalFailure(
      error instanceof Error ? error.message : "The model could not be configured",
    );
  }

  await store.recordAudit(auditId, decision, modelId);
  await applyDecision(claim.dealId, decision);

  return { status: "DONE", outcome: decision.outcome };
}
