import "server-only";
import { randomUUID } from "node:crypto";
import {
  beginCapture,
  getCapturePayment,
  markCaptureFailed,
  markCapturePending,
  saveCaptureOrder,
} from "@/lib/db/checkout-store";
import { PayPalApiError, paypalRequest } from "./client";
import {
  approvalUrl,
  buildCaptureOrder,
  capturedId,
  type PayPalOrder,
} from "./orders";

// FR3: buyer pays with PayPal Checkout. The order is created server-side from
// the stored amount, the buyer approves on PayPal, and this module captures the
// order. The deal only becomes FUNDS_HELD when the webhook confirms the capture.

const ORDERS_PATH = "/v2/checkout/orders";

export type StartCheckoutInput = {
  dealId: string;
  origin: string;
};

export type CaptureOutcome = "approved" | "processing" | "failed";

function describe(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown PayPal error";
}

export async function startCheckout(
  input: StartCheckoutInput,
): Promise<{ approvalUrl: string }> {
  // Stored on the payment row before the call; also used as PayPal's request id.
  const idempotencyKey = `shield-capture-${input.dealId}-${randomUUID()}`;
  const intent = await beginCapture(input.dealId, idempotencyKey);

  const body = buildCaptureOrder({
    dealId: intent.dealId,
    title: intent.title,
    amountCents: intent.amountCents,
    returnUrl: `${input.origin}/api/paypal/capture/${intent.dealId}`,
    cancelUrl: `${input.origin}/t/${intent.dealId}?payment=cancelled`,
  });

  let order: PayPalOrder;

  try {
    order = await paypalRequest<PayPalOrder>({
      method: "POST",
      path: ORDERS_PATH,
      requestId: idempotencyKey,
      body,
    });
  } catch (error) {
    await markCaptureFailed(intent.paymentId, describe(error)).catch((failure) => {
      console.error("Could not mark the capture as failed", failure);
    });
    throw error;
  }

  const orderId = order.id;
  const url = orderId ? approvalUrl(order) : null;

  if (!orderId || !url) {
    const reason = orderId
      ? "PayPal returned no approval link for the order."
      : "PayPal returned no order id.";
    await markCaptureFailed(intent.paymentId, reason).catch((failure) => {
      console.error("Could not mark the capture as failed", failure);
    });
    throw new Error(reason);
  }

  await saveCaptureOrder(intent.paymentId, orderId);

  return { approvalUrl: url };
}

export async function confirmCheckout(input: {
  dealId: string;
  orderId: string;
}): Promise<CaptureOutcome> {
  const payment = await getCapturePayment(input.dealId);

  if (!payment) {
    throw new Error("No capture payment exists for this deal.");
  }

  if (payment.status === "COMPLETED") return "approved";
  if (payment.status === "PENDING") return "processing";
  if (payment.status === "FAILED" || payment.status === "DENIED") return "failed";

  // A second checkout click can replace the stored order id before this return
  // arrives. Adopting the returned token keeps the capture and its webhook on
  // the same payment row.
  if (payment.paypalOrderId !== input.orderId) {
    await saveCaptureOrder(payment.id, input.orderId);
  }

  try {
    const captured = await paypalRequest<PayPalOrder>({
      method: "POST",
      path: `${ORDERS_PATH}/${encodeURIComponent(input.orderId)}/capture`,
      requestId: `shield-confirm-${payment.id}`,
      body: {},
    });

    const captureId = capturedId(captured);

    if (captured.status === "COMPLETED" && captureId) {
      await markCapturePending(payment.id, input.orderId, captureId);
      return "approved";
    }

    return "processing";
  } catch (error) {
    if (error instanceof PayPalApiError) {
      const alreadyCaptured =
        error.status === 422 &&
        /ORDER_ALREADY_CAPTURED|ORDER_COMPLETED|CAPTURE_FULLY_REFUNDED/.test(
          error.detail,
        );

      if (alreadyCaptured) return "approved";

      await markCaptureFailed(payment.id, error.message).catch((failure) => {
        console.error("Could not mark the capture as failed", failure);
      });
      return "failed";
    }

    // A timeout means the outcome is unknown. Leave the row for the webhook.
    console.error("PayPal capture outcome is unknown", error);
    return "processing";
  }
}
