import "server-only";
import {
  canTransition,
  type DealState,
} from "@/lib/state-machine/states";
import {
  transition,
  type JsonObject,
} from "@/lib/state-machine/transition";
import {
  captureStatusForEvent,
  isCaptureEvent,
  isPayoutItemEvent,
  orderIdFromResource,
  parsePayPalWebhookEvent,
  payoutItemStatusForEvent,
  senderItemIdFromResource,
  type PayPalWebhookEvent,
} from "@/lib/paypal/webhook-event";
import { SupabaseTransitionStore } from "./transition-store";
import { getSupabaseAdmin } from "./server";

// PayPal webhooks are the only voice that may set RELEASED/REFUNDED. These
// handlers are idempotent: retries with the same webhook id hit the same
// payment rows, and the state machine rejects a repeat transition.

const STORE = new SupabaseTransitionStore();

type PaymentRow = {
  id: string;
  deal_id: string;
  purpose: "CAPTURE" | "PAYOUT" | "REFUND";
  status: string;
  paypal_capture_id: string | null;
  paypal_order_id: string | null;
  paypal_refund_id: string | null;
  paypal_payout_item_id: string | null;
  paypal_payout_batch_id: string | null;
};

type DealStateRow = {
  state: DealState;
};

const PAYMENT_COLUMNS =
  "id, deal_id, purpose, status, paypal_capture_id, paypal_order_id, paypal_refund_id, paypal_payout_item_id, paypal_payout_batch_id";

type PaymentPatch = Record<string, unknown>;
type PaymentLookup = { row: PaymentRow | null; patch: PaymentPatch | null };

async function findPaymentRowBy(
  column: keyof PaymentRow,
  value: string,
): Promise<PaymentRow | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("payments")
    .select(PAYMENT_COLUMNS)
    .eq(column, value)
    .limit(1)
    .maybeSingle<PaymentRow>();

  if (error) {
    throw new Error(`Could not read payments by ${column}: ${error.message}`);
  }

  return data ?? null;
}

function capturePatch({
  event,
  purpose,
}: {
  event: PayPalWebhookEvent;
  purpose: PaymentRow["purpose"];
}): PaymentPatch | null {
  const status = captureStatusForEvent(event.eventType);
  if (!status) return null;

  const resourceId = event.resource.id ?? null;
  if (purpose === "REFUND") {
    // A refunded webhook points at the refund row, not the capture row.
    return { status, ...(resourceId ? { paypal_refund_id: resourceId } : {}) };
  }

  const orderId = orderIdFromResource(event.resource);

  return {
    status,
    ...(resourceId ? { paypal_capture_id: resourceId } : {}),
    ...(orderId ? { paypal_order_id: orderId } : {}),
  };
}

function payoutPatch(event: PayPalWebhookEvent): PaymentPatch | null {
  const status = payoutItemStatusForEvent(event.eventType);
  if (!status) return null;

  const payoutItemId = event.resource.id ?? event.resource.payout_item_id ?? null;

  return {
    status,
    ...(payoutItemId ? { paypal_payout_item_id: payoutItemId } : {}),
    ...(event.resource.payout_batch_id
      ? { paypal_payout_batch_id: event.resource.payout_batch_id }
      : {}),
  };
}

function orderApprovedPatch(event: PayPalWebhookEvent): PaymentPatch | null {
  const orderId = event.resource.id;

  return orderId
    ? { status: "APPROVED", paypal_order_id: orderId }
    : null;
}

async function findPayment(event: PayPalWebhookEvent): Promise<PaymentLookup> {
  const { resource } = event;
  const orderId = orderIdFromResource(resource);

  if (isCaptureEvent(event.eventType)) {
    const captureId = resource.id;
    let row: PaymentRow | null = null;

    if (captureId) {
      row = await findPaymentRowBy("paypal_capture_id", captureId);
    }
    if (!row && orderId) {
      row = await findPaymentRowBy("paypal_order_id", orderId);
    }

    return {
      row,
      patch: row ? capturePatch({ event, purpose: row.purpose }) : null,
    };
  }

  if (event.eventType === "CHECKOUT.ORDER.APPROVED") {
    const row = resource.id ? await findPaymentRowBy("paypal_order_id", resource.id) : null;
    return { row, patch: row ? orderApprovedPatch(event) : null };
  }

  if (isPayoutItemEvent(event.eventType)) {
    const payoutItemId = resource.id ?? resource.payout_item_id;
    const batchId = resource.payout_batch_id;
    const senderItemId = senderItemIdFromResource(resource);

    const itemRow = payoutItemId ? await findPaymentRowBy("paypal_payout_item_id", payoutItemId) : null;
    const batchRow = batchId ? await findPaymentRowBy("paypal_payout_batch_id", batchId) : null;
    const paymentRow = itemRow ?? batchRow;

    if (paymentRow) {
      return { row: paymentRow, patch: payoutPatch(event) };
    }

    // If the batch or item id is not stored yet, the sender item id is the
    // idempotency-backed payment id we wrote on the way out.
    const senderRow = senderItemId ? await findPaymentRowBy("id", senderItemId) : null;
    return { row: senderRow, patch: senderRow ? payoutPatch(event) : null };
  }

  return { row: null, patch: null };
}

async function updatePayment(paymentId: string, patch: PaymentPatch): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("payments")
    .update(patch)
    .eq("id", paymentId);

  if (error) {
    throw new Error(`Could not persist PayPal event: ${error.message}`);
  }
}

function transitionTarget(eventType: string): DealState | null {
  switch (eventType) {
    case "PAYMENT.CAPTURE.COMPLETED":
      return "FUNDS_HELD";
    case "PAYMENT.CAPTURE.REVERSED":
      return "ESCALATED";
    case "PAYMENT.CAPTURE.REFUNDED":
      return "REFUNDED";
    case "PAYMENT.PAYOUTS-ITEM.SUCCEEDED":
      return "RELEASED";
    default:
      return null;
  }
}

async function readDealState(dealId: string): Promise<DealState | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("deals")
    .select("state")
    .eq("id", dealId)
    .maybeSingle<DealStateRow>();

  if (error) {
    throw new Error(`Could not read the deal before a webhook: ${error.message}`);
  }

  return data?.state ?? null;
}

async function maybeTransition({
  dealId,
  eventType,
  webhookEventId,
}: {
  dealId: string;
  eventType: string;
  webhookEventId: string;
}): Promise<void> {
  const target = transitionTarget(eventType);
  if (!target) return;

  const currentState = await readDealState(dealId);
  if (!currentState || !canTransition(currentState, target)) return;

  const payload: JsonObject = {
    webhookEventId,
    source: "paypal-webhook",
    eventType,
  };

  try {
    await transition({ dealId, from: currentState, to: target, actor: "paypal", payload }, STORE);
  } catch {
    // The transaction may have been revalidated between the read and the write.
    return;
  }
}

export async function processPayPalWebhook(payload: unknown): Promise<void> {
  const event = parsePayPalWebhookEvent(payload);
  if (!event) return;

  const { row, patch } = await findPayment(event);
  if (!row || !patch) return;

  await updatePayment(row.id, patch);
  await maybeTransition({
    dealId: row.deal_id,
    eventType: event.eventType,
    webhookEventId: event.id,
  });
}
