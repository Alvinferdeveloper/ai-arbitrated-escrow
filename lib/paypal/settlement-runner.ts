import "server-only";
import { SupabaseSettlementStore } from "@/lib/db/settlement-store";
import { SupabaseTransitionStore } from "@/lib/db/transition-store";
import { executeSettlement } from "@/lib/state-machine/settlement";
import { TransitionConflictError, transition } from "@/lib/state-machine/transition";
import { isPayPalConfigured } from "./config";
import { createPayPalSettlementGateway } from "./settlement";

// The single entry point the app uses after a release or refund is queued:
// if PayPal's sandbox credentials are present the settlement is sent right
// away, otherwise the pending row stays for a later retry or manual step.

export async function runPendingSettlement(dealId: string) {
  if (!isPayPalConfigured()) {
    return {
      outcome: "SKIPPED" as const,
      reason: "PAYPAL_NOT_CONFIGURED",
    };
  }

  return executeSettlement(
    dealId,
    new SupabaseSettlementStore(),
    createPayPalSettlementGateway(),
  );
}

/** Sends an AI refund; if PayPal refuses it, a person takes the case. */
export async function runAiRefund(dealId: string) {
  const result = await runPendingSettlement(dealId);
  if (result.outcome !== "FAILED") return result;

  try {
    await transition(
      {
        dealId,
        from: "REFUNDING",
        to: "ESCALATED",
        actor: "system",
        payload: {
          rule: "TECHNICAL_FAILURE",
          reasonDetail: "PayPal refused the refund the AI started. A person finishes the case.",
        },
      },
      new SupabaseTransitionStore(),
    );
  } catch (error) {
    if (!(error instanceof TransitionConflictError)) throw error;
  }

  return result;
}
