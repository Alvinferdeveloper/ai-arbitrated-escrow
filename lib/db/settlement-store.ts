import "server-only";
import type {
  Currency,
  MarkSubmittedInput,
  PendingSettlement,
  SettlementStore,
} from "@/lib/state-machine/settlement";
import { getSupabaseAdmin } from "./server";

// The only Supabase writer for PayPal settlements. The pending row keeps its
// idempotency key; markSubmitted stores the PayPal identity after the call,
// and the transition to RELEASED/REFUNDED happens only via the webhook.

type DealRow = {
  id: string;
  state: string;
  seller_id: string;
};

type SellerRow = {
  paypal_email: string | null;
};

type CaptureRow = {
  paypal_capture_id: string | null;
};

type SettlementInvocation = {
  id: string;
  deal_id: string;
  purpose: "PAYOUT" | "REFUND";
  status: string;
  amount_cents: number;
  currency: string;
  idempotency_key: string;
  paypal_capture_id: string | null;
  paypal_payout_batch_id: string | null;
  paypal_refund_id: string | null;
};

function currencyOf(value: string): Currency {
  if (value !== "USD") {
    throw new Error(`Only USD settlements are supported (got ${value}).`);
  }
  return "USD";
}

async function updatePayment(
  paymentId: string,
  patch:
    | { status: "PENDING"; payoutBatchId?: string; refundId?: string }
    | { status: "FAILED"; failureReason: string },
): Promise<void> {
  const admin = getSupabaseAdmin();
  const values: Record<string, unknown> =
    patch.status === "PENDING"
      ? {
          status: "PENDING",
          failure_reason: null,
          ...(patch.payoutBatchId ? { paypal_payout_batch_id: patch.payoutBatchId } : {}),
          ...(patch.refundId ? { paypal_refund_id: patch.refundId } : {}),
        }
      : { status: "FAILED", failure_reason: patch.failureReason };

  const { error } = await admin.from("payments").update(values).eq("id", paymentId);
  if (error) {
    throw new Error(`Could not persist settlement state: ${error.message}`);
  }
}

export class SupabaseSettlementStore implements SettlementStore {
  async getPendingSettlement(dealId: string): Promise<PendingSettlement | null> {
    const admin = getSupabaseAdmin();

    const { data: payments, error: paymentsError } = await admin
      .from("payments")
      .select(
        "id, deal_id, purpose, status, amount_cents, currency, idempotency_key, paypal_capture_id, paypal_payout_batch_id, paypal_refund_id",
      )
      .eq("deal_id", dealId)
      .in("purpose", ["PAYOUT", "REFUND"])
      .eq("status", "PENDING")
      .order("created_at", { ascending: false })
      .limit(1)
      .returns<SettlementInvocation[]>();

    if (paymentsError) {
      throw new Error(`Could not load pending settlements: ${paymentsError.message}`);
    }

    const payment = payments?.[0];
    if (!payment) return null;

    const dealResult = await admin
      .from("deals")
      .select("id, state, seller_id")
      .eq("id", dealId)
      .maybeSingle<DealRow>();
    if (dealResult.error) {
      throw new Error(`Could not load the deal: ${dealResult.error.message}`);
    }

    const deal = dealResult.data;
    if (!deal) return null;

    const sellerResult = await admin
      .from("users")
      .select("paypal_email")
      .eq("id", deal.seller_id)
      .maybeSingle<SellerRow>();
    if (sellerResult.error) {
      throw new Error(`Could not load the seller: ${sellerResult.error.message}`);
    }

    const captureResult = await admin
      .from("payments")
      .select("paypal_capture_id")
      .eq("deal_id", dealId)
      .eq("purpose", "CAPTURE")
      .maybeSingle<CaptureRow>();
    if (captureResult.error) {
      throw new Error(`Could not load the capture: ${captureResult.error.message}`);
    }

    const providerId =
      payment.purpose === "PAYOUT" ? payment.paypal_payout_batch_id : payment.paypal_refund_id;

    return {
      paymentId: payment.id,
      dealId: payment.deal_id,
      purpose: payment.purpose,
      amountCents: payment.amount_cents,
      currency: currencyOf(payment.currency),
      idempotencyKey: payment.idempotency_key,
      sellerPaypalEmail: sellerResult.data?.paypal_email ?? null,
      captureId: payment.paypal_capture_id ?? captureResult.data?.paypal_capture_id ?? null,
      providerId: providerId ?? null,
      dealState: (deal.state as PendingSettlement["dealState"]) ?? null,
    };
  }

  async markSubmitted(input: MarkSubmittedInput): Promise<void> {
    if (input.purpose === "PAYOUT") {
      await updatePayment(input.paymentId, {
        status: "PENDING",
        payoutBatchId: input.payoutBatchId,
      });
      return;
    }

    await updatePayment(input.paymentId, {
      status: "PENDING",
      refundId: input.refundId,
    });
  }

  async markFailed(paymentId: string, reason: string): Promise<void> {
    await updatePayment(paymentId, {
      status: "FAILED",
      failureReason: reason.slice(0, 500),
    });
  }
}
