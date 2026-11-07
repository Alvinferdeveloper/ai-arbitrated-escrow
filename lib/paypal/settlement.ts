import "server-only";
import type {
  PayoutRequest,
  PayoutResult,
  RefundRequest,
  RefundResult,
  SettlementGateway,
} from "@/lib/state-machine/settlement";
import { APP_NAME } from "@/lib/config";
import { paypalRequest } from "./client";
import { requirePayPalConfig } from "./config";

// The payout and refund wrappers the state machine calls. PayPal's
// PayPal-Request-Id header uses the same idempotency key stored in `payments`,
// so a retry never pays twice.

type PayoutsPayload = {
  batch_header?: {
    payout_batch_id?: string;
    batch_status?: string;
  };
};

type RefundPayload = {
  id?: string;
  status?: string;
};

function amountValue(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function createPayPalSettlementGateway(): SettlementGateway {
  return {
    async createPayout(request: PayoutRequest): Promise<PayoutResult> {
      const config = requirePayPalConfig();

      const payload = await paypalRequest<PayoutsPayload>({
        method: "POST",
        path: "/v1/payments/payouts",
        requestId: request.idempotencyKey,
        body: {
          sender_batch_header: {
            sender_batch_id: request.idempotencyKey,
            email_subject: `Your ${APP_NAME} payout`,
            email_message: "The held funds were released after the deal settled.",
          },
          items: [
            {
              recipient_type: "EMAIL",
              amount: {
                value: amountValue(request.amountCents),
                currency: request.currency,
              },
              receiver: request.recipientEmail,
              sender_item_id: `shield-${request.paymentId}`,
            },
          ],
        },
        config,
      });

      const batchId = payload.batch_header?.payout_batch_id;
      if (!batchId) {
        throw new Error("PayPal payout response had no batch id.");
      }

      return { payoutBatchId: batchId };
    },

    async createRefund(request: RefundRequest): Promise<RefundResult> {
      const config = requirePayPalConfig();

      const payload = await paypalRequest<RefundPayload>({
        method: "POST",
        path: `/v2/payments/captures/${encodeURIComponent(request.captureId)}/refund`,
        requestId: request.idempotencyKey,
        body: {
          amount: {
            value: amountValue(request.amountCents),
            currency_code: request.currency,
          },
          invoice_id: `shield-${request.dealId}`,
          note_to_payer: `Refund from ${APP_NAME}.`,
        },
        config,
      });

      const refundId = payload.id;
      if (!refundId) {
        throw new Error("PayPal refund response had no refund id.");
      }

      return { refundId };
    },
  };
}
