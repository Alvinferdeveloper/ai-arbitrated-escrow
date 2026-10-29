import "server-only";
import {
  MediationConflictError,
  type MediationSettlement,
  type MediatorDecisionStore,
  type PaymentStatus,
  type QueueSettlementInput,
  type SettlementPurpose,
} from "@/lib/state-machine/mediator";
import { DealNotFoundError } from "@/lib/state-machine/transition";
import { getSupabaseAdmin } from "./server";
import { SupabaseTransitionStore } from "./transition-store";

type SettlementRpcRow = {
  payment_id: string;
  purpose: SettlementPurpose;
  status: PaymentStatus;
  idempotency_key: string;
  created_at: string;
};

export class SupabaseMediatorDecisionStore
  extends SupabaseTransitionStore
  implements MediatorDecisionStore
{
  async queueSettlement(
    input: QueueSettlementInput,
  ): Promise<MediationSettlement> {
    const { data, error } = await getSupabaseAdmin()
      .rpc("queue_mediation_settlement", {
        p_deal_id: input.dealId,
        p_purpose: input.action === "RELEASE" ? "PAYOUT" : "REFUND",
        p_note: input.note ?? null,
        p_idempotency_key: input.idempotencyKey,
      })
      .returns<SettlementRpcRow[]>()
      .single<SettlementRpcRow>();

    if (error) {
      if (error.code === "P0002" || error.message.includes("deal_not_found")) {
        throw new DealNotFoundError(input.dealId);
      }

      if (
        error.code === "40001" ||
        error.code === "22023" ||
        error.message.includes("mediation_state_conflict") ||
        error.message.includes("settlement_already_queued")
      ) {
        throw new MediationConflictError(
          input.dealId,
          error.details || error.message,
        );
      }

      throw new Error(`Supabase settlement failed: ${error.message}`);
    }

    if (!data) {
      throw new Error("Supabase settlement returned no payment");
    }

    return {
      paymentId: data.payment_id,
      purpose: data.purpose,
      status: data.status,
      idempotencyKey: data.idempotency_key,
    };
  }
}
