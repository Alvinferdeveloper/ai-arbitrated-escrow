import "server-only";
import {
  SupabaseEvidenceAuditJobStore,
  getLatestEvidenceAudit,
  type FinishedAuditRow,
} from "@/lib/db/evidence-store";
import { SupabaseShippingStore } from "@/lib/db/shipping-store";
import { SupabaseTransitionStore } from "@/lib/db/transition-store";
import { applyEvidenceDecision } from "@/lib/state-machine/evidence-outcome";
import { TransitionConflictError } from "@/lib/state-machine/transition";
import type { EvidenceAuditDecision } from "./audit";
import { runEvidenceAudit, type RunEvidenceAuditResult } from "./evidence-audit-job";
import { createVisionModel } from "./model";
import { resolveModel } from "./provider";
import { evaluateEvidenceRules } from "./rules";
import { evidenceAuditSchema } from "./schemas";

async function applyDecision(dealId: string, decision: EvidenceAuditDecision) {
  try {
    await applyEvidenceDecision(dealId, decision, {
      transitions: new SupabaseTransitionStore(),
      shipping: new SupabaseShippingStore(),
    });
  } catch (error) {
    // Another run already moved the deal.
    if (error instanceof TransitionConflictError) return;
    throw error;
  }
}

export function runStoredEvidenceAudit(auditId: string): Promise<RunEvidenceAuditResult> {
  return runEvidenceAudit({
    auditId,
    store: new SupabaseEvidenceAuditJobStore(),
    getModel: () => {
      const resolved = resolveModel();
      return { model: createVisionModel(resolved), modelId: resolved.modelId };
    },
    applyDecision,
  });
}

/** Rebuilds the decision from the stored result. Only the newest audit may decide. */
export async function settleFinishedAudit(row: FinishedAuditRow): Promise<boolean> {
  const latest = await getLatestEvidenceAudit(row.dealId);
  if (latest?.id !== row.id) return false;

  const parsed = evidenceAuditSchema.safeParse(row.result);
  const decision: EvidenceAuditDecision = parsed.success
    ? evaluateEvidenceRules(parsed.data, { priceCents: row.priceCents })
    : {
        outcome: "ESCALATE",
        triggeredRules: ["TECHNICAL_FAILURE"],
        evidenceIssues: [],
        audit: null,
        technicalError: row.error ?? "The stored audit is not valid",
      };

  await applyDecision(row.dealId, decision);
  return true;
}
