import "server-only";
import { getSupabaseAdmin } from "./server";

// Persistence for the buyer's capture (FR3). The payment row is written by the
// begin_capture RPC before PayPal is called; the capture response only moves it
// to PENDING. FUNDS_HELD is still decided by the webhook.

export type CaptureIntent = {
  paymentId: string;
  dealId: string;
  title: string;
  amountCents: number;
  currency: "USD";
  idempotencyKey: string;
  paypalOrderId: string | null;
};

export type CapturePayment = {
  id: string;
  dealId: string;
  status: string;
  amountCents: number;
  paypalOrderId: string | null;
  paypalCaptureId: string | null;
  idempotencyKey: string;
};

export class CheckoutUnavailableError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "CheckoutUnavailableError";
  }
}

type BeginCaptureRow = {
  payment_id: string;
  deal_id: string;
  title: string;
  amount_cents: number;
  currency: string;
  status: string;
  paypal_order_id: string | null;
  idempotency_key: string;
};

type CaptureRow = {
  id: string;
  deal_id: string;
  status: string;
  amount_cents: number;
  paypal_order_id: string | null;
  paypal_capture_id: string | null;
  idempotency_key: string;
};

export async function beginCapture(
  dealId: string,
  idempotencyKey: string,
): Promise<CaptureIntent> {
  const { data, error } = await getSupabaseAdmin()
    .rpc("begin_capture", {
      p_deal_id: dealId,
      p_idempotency_key: idempotencyKey,
    })
    .returns<BeginCaptureRow[]>()
    .single<BeginCaptureRow>();

  if (error) {
    const known = [
      "deal_not_found",
      "deal_not_awaiting_payment",
      "payment_in_progress",
      "invalid_idempotency_key",
    ].find((code) => error.message.includes(code));

    if (known) throw new CheckoutUnavailableError(known);

    throw new Error(`Supabase begin_capture failed: ${error.message}`);
  }

  if (!data) {
    throw new Error("Supabase begin_capture returned no payment");
  }

  if (data.currency !== "USD") {
    throw new Error(`Only USD checkouts are supported (got ${data.currency}).`);
  }

  return {
    paymentId: data.payment_id,
    dealId: data.deal_id,
    title: data.title,
    amountCents: data.amount_cents,
    currency: "USD",
    idempotencyKey: data.idempotency_key,
    paypalOrderId: data.paypal_order_id,
  };
}

export async function getCapturePayment(
  dealId: string,
): Promise<CapturePayment | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("payments")
    .select(
      "id, deal_id, status, amount_cents, paypal_order_id, paypal_capture_id, idempotency_key",
    )
    .eq("deal_id", dealId)
    .eq("purpose", "CAPTURE")
    .maybeSingle<CaptureRow>();

  if (error) {
    throw new Error(`Could not load the capture payment: ${error.message}`);
  }

  if (!data) return null;

  return {
    id: data.id,
    dealId: data.deal_id,
    status: data.status,
    amountCents: data.amount_cents,
    paypalOrderId: data.paypal_order_id,
    paypalCaptureId: data.paypal_capture_id,
    idempotencyKey: data.idempotency_key,
  };
}

export async function saveCaptureOrder(
  paymentId: string,
  orderId: string,
): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("payments")
    .update({ paypal_order_id: orderId, status: "CREATED", failure_reason: null })
    .eq("id", paymentId);

  if (error) {
    throw new Error(`Could not store the PayPal order id: ${error.message}`);
  }
}

export async function markCapturePending(
  paymentId: string,
  orderId: string,
  captureId: string,
): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("payments")
    .update({
      status: "PENDING",
      paypal_order_id: orderId,
      paypal_capture_id: captureId,
      failure_reason: null,
    })
    .eq("id", paymentId)
    // A fast webhook may already have set COMPLETED; never downgrade it.
    .in("status", ["CREATED", "APPROVED"]);

  if (error) {
    throw new Error(`Could not store the pending capture: ${error.message}`);
  }
}

export async function markCaptureFailed(
  paymentId: string,
  reason: string,
): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("payments")
    .update({ status: "FAILED", failure_reason: reason.slice(0, 500) })
    .eq("id", paymentId);

  if (error) {
    throw new Error(`Could not store the capture failure: ${error.message}`);
  }
}
