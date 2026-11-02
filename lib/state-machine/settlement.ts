import { CURRENCY } from "@/lib/config";
import type { DealState } from "./states";

// Settlement is the only path that moves money: a release or refund already
// queued in `payments` is sent to PayPal here, wrapped by the state machine.
// The web keys stay the same as the DB idempotency key, so a retry never pays
// or refunds twice. Nothing transitions the deal here; only the PayPal webhook
// confirms `RELEASED` or `REFUNDED`.

export type Currency = typeof CURRENCY;

export type PayoutRequest = {
  paymentId: string;
  dealId: string;
  amountCents: number;
  currency: Currency;
  recipientEmail: string;
  idempotencyKey: string;
};

export type PayoutResult = {
  payoutBatchId: string;
};

export type RefundRequest = {
  paymentId: string;
  dealId: string;
  amountCents: number;
  currency: Currency;
  captureId: string;
  idempotencyKey: string;
};

export type RefundResult = {
  refundId: string;
};

export type SettlementGateway = {
  createPayout(request: PayoutRequest): Promise<PayoutResult>;
  createRefund(request: RefundRequest): Promise<RefundResult>;
};

export type PendingSettlement = {
  paymentId: string;
  dealId: string;
  purpose: "PAYOUT" | "REFUND";
  amountCents: number;
  currency: Currency;
  idempotencyKey: string;
  sellerPaypalEmail: string | null;
  captureId: string | null;
  /// Payout batch id or refund id already attached to the payment row.
  providerId: string | null;
  dealState: DealState | null;
};

export type MarkSubmittedInput =
  | { purpose: "PAYOUT"; paymentId: string; payoutBatchId: string }
  | { purpose: "REFUND"; paymentId: string; refundId: string };

export type SettlementStore = {
  getPendingSettlement(dealId: string): Promise<PendingSettlement | null>;
  markSubmitted(input: MarkSubmittedInput): Promise<void>;
  markFailed(paymentId: string, reason: string): Promise<void>;
};

export type SettlementOutcome = {
  outcome: "SUBMITTED" | "SKIPPED" | "FAILED";
  reason?: string;
  payoutBatchId?: string;
  refundId?: string;
};

function failureReason(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, 200);
  }
  return "unknown settlement error";
}

export async function executeSettlement(
  dealId: string,
  store: SettlementStore,
  gateway: SettlementGateway,
): Promise<SettlementOutcome> {
  const settlement = await store.getPendingSettlement(dealId);

  if (!settlement) {
    return { outcome: "SKIPPED", reason: "NO_PENDING_SETTLEMENT" };
  }

  // SHIPPED covers the buyer's confirmation and the auto-release cron; the
  // deal reaches RELEASED only after PayPal's webhook confirms the payout.
  if (
    settlement.dealState !== "SHIPPED" &&
    settlement.dealState !== "ESCALATED" &&
    settlement.dealState !== "ARBITRATING" &&
    settlement.dealState !== "REFUNDING"
  ) {
    return { outcome: "SKIPPED", reason: "DEAL_NOT_OPEN_TO_SETTLE" };
  }

  if (settlement.providerId) {
    return { outcome: "SKIPPED", reason: "ALREADY_SUBMITTED" };
  }

  if (settlement.purpose === "PAYOUT") {
    if (!settlement.sellerPaypalEmail) {
      await store.markFailed(settlement.paymentId, "seller has no payout email");
      return { outcome: "FAILED", reason: "SELLER_PAYPAL_EMAIL_MISSING" };
    }

    try {
      const payout = await gateway.createPayout({
        paymentId: settlement.paymentId,
        dealId,
        amountCents: settlement.amountCents,
        currency: settlement.currency,
        recipientEmail: settlement.sellerPaypalEmail,
        idempotencyKey: settlement.idempotencyKey,
      });

      await store.markSubmitted({
        purpose: "PAYOUT",
        paymentId: settlement.paymentId,
        payoutBatchId: payout.payoutBatchId,
      });

      return { outcome: "SUBMITTED", payoutBatchId: payout.payoutBatchId };
    } catch (error) {
      await store.markFailed(settlement.paymentId, failureReason(error)).catch(() => undefined);
      return { outcome: "FAILED", reason: failureReason(error) };
    }
  }

  if (!settlement.captureId) {
    await store.markFailed(settlement.paymentId, "no PayPal capture on this deal");
    return { outcome: "FAILED", reason: "CAPTURE_ID_MISSING" };
  }

  try {
    const refund = await gateway.createRefund({
      paymentId: settlement.paymentId,
      dealId,
      amountCents: settlement.amountCents,
      currency: settlement.currency,
      captureId: settlement.captureId,
      idempotencyKey: settlement.idempotencyKey,
    });

    await store.markSubmitted({
      purpose: "REFUND",
      paymentId: settlement.paymentId,
      refundId: refund.refundId,
    });

    return { outcome: "SUBMITTED", refundId: refund.refundId };
  } catch (error) {
    await store.markFailed(settlement.paymentId, failureReason(error)).catch(() => undefined);
    return { outcome: "FAILED", reason: failureReason(error) };
  }
}
