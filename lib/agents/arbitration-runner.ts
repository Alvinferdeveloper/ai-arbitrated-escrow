import "server-only";
import {
  SupabaseArbitrationJobStore,
  SupabaseArbitrationOutcomeStore,
  loadSellerAudit,
  type FinishedArbitrationRow,
} from "@/lib/db/dispute-store";
import { getLatestEvidenceAudit } from "@/lib/db/evidence-store";
import { runPendingSettlement } from "@/lib/paypal/settlement-runner";
import { applyArbitrationDecision } from "@/lib/state-machine/arbitration-outcome";
import { MediationConflictError } from "@/lib/state-machine/mediator";
import { TransitionConflictError } from "@/lib/state-machine/transition";
import type { ArbitrationDecision } from "./arbitration";
import { runArbitration, type RunArbitrationResult } from "./arbitration-job";
import { evaluateArbitrationRules } from "./arbitration-rules";
import { createVisionModel } from "./model";
import { resolveModel } from "./provider";
import { buyerEvidenceSchema } from "./schemas";

async function applyDecision(dealId: string, decision: ArbitrationDecision) {
  try {
    const result = await applyArbitrationDecision(
      dealId,
      decision,
      new SupabaseArbitrationOutcomeStore(),
    );
    if (result.status === "SETTLEMENT_QUEUED") await runPendingSettlement(dealId);
  } catch (error) {
    // Another run already moved the deal or queued the settlement.
    if (error instanceof TransitionConflictError || error instanceof MediationConflictError) return;
    throw error;
  }
}

export function runStoredArbitration(auditId: string): Promise<RunArbitrationResult> {
  return runArbitration({
    auditId,
    store: new SupabaseArbitrationJobStore(),
    getModel: () => {
      const resolved = resolveModel();
      return { model: createVisionModel(resolved), modelId: resolved.modelId };
    },
    applyDecision,
  });
}

/** Rebuilds the verdict from the stored result. Only the newest arbitration may decide. */
export async function settleFinishedArbitration(row: FinishedArbitrationRow): Promise<boolean> {
  const latest = await getLatestEvidenceAudit(row.dealId, "ARBITRATION");
  if (latest?.id !== row.id) return false;

  const buyerAudit = buyerEvidenceSchema.safeParse(row.result);
  const sellerAudit = await loadSellerAudit(row.dealId);

  const decision: ArbitrationDecision =
    buyerAudit.success && sellerAudit
      ? {
          ...evaluateArbitrationRules({ sellerAudit, buyerAudit: buyerAudit.data }),
          buyerAudit: buyerAudit.data,
          sellerAudit,
        }
      : {
          outcome: "ESCALATE",
          triggeredRules: ["TECHNICAL_FAILURE"],
          reason: "The stored arbitration is not valid",
          buyerAudit: null,
          sellerAudit,
          technicalError: "The stored arbitration is not valid",
        };

  await applyDecision(row.dealId, decision);
  return true;
}
