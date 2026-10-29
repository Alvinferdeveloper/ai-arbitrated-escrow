import "server-only";
import { SupabaseSettlementStore } from "@/lib/db/settlement-store";
import { executeSettlement } from "@/lib/state-machine/settlement";
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
