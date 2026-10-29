import { z } from "zod";

// Every PayPal webhook we subscribe to, parsed into the few facts the handlers
// need. `resource` is intentionally loose so unknown extra fields do not
// reject an otherwise usable event.

const amountSchema = z.looseObject({
  value: z.string().optional(),
  currency: z.string().optional(),
  currency_code: z.string().optional(),
});

const resourceSchema = z.looseObject({
  id: z.string().optional(),
  status: z.string().optional(),
  amount: amountSchema.optional(),
  supplementary_data: z
    .looseObject({
      related_ids: z
        .looseObject({
          order_id: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  payout_item_id: z.string().optional(),
  payout_batch_id: z.string().optional(),
  sender_item_id: z.string().optional(),
  payout_item: z
    .looseObject({
      sender_item_id: z.string().optional(),
    })
    .optional(),
});

const webhookEventSchema = z.looseObject({
  id: z.string(),
  event_type: z.string(),
  resource: resourceSchema,
});

export type PayPalWebhookResource = z.infer<typeof resourceSchema>;

export type PayPalWebhookEvent = {
  id: string;
  eventType: string;
  resource: PayPalWebhookResource;
};

export type WebhookVerificationInput = {
  headers: Headers;
  event: unknown;
};

const CAPTURE_STATUS_BY_EVENT: Record<string, string> = {
  "PAYMENT.CAPTURE.PENDING": "PENDING",
  "PAYMENT.CAPTURE.COMPLETED": "COMPLETED",
  "PAYMENT.CAPTURE.DENIED": "DENIED",
  "PAYMENT.CAPTURE.REFUNDED": "REFUNDED",
  "PAYMENT.CAPTURE.REVERSED": "REVERSED",
};

const PAYOUT_ITEM_STATUS_BY_EVENT: Record<string, string> = {
  "PAYMENT.PAYOUTS-ITEM.SUCCEEDED": "COMPLETED",
  "PAYMENT.PAYOUTS-ITEM.FAILED": "FAILED",
  "PAYMENT.PAYOUTS-ITEM.DENIED": "DENIED",
  "PAYMENT.PAYOUTS-ITEM.BLOCKED": "BLOCKED",
  "PAYMENT.PAYOUTS-ITEM.RETURNED": "RETURNED",
  "PAYMENT.PAYOUTS-ITEM.UNCLAIMED": "UNCLAIMED",
};

export function isCaptureEvent(eventType: string): boolean {
  return eventType.startsWith("PAYMENT.CAPTURE.");
}

export function isPayoutItemEvent(eventType: string): boolean {
  return eventType.startsWith("PAYMENT.PAYOUTS-ITEM.");
}

export function captureStatusForEvent(eventType: string): string | null {
  return CAPTURE_STATUS_BY_EVENT[eventType] ?? null;
}

export function payoutItemStatusForEvent(eventType: string): string | null {
  return PAYOUT_ITEM_STATUS_BY_EVENT[eventType] ?? null;
}

export function orderIdFromResource(resource: PayPalWebhookResource): string | null {
  return resource.supplementary_data?.related_ids?.order_id ?? null;
}

export function senderItemIdFromResource(
  resource: PayPalWebhookResource | undefined,
): string | null {
  return resource?.payout_item?.sender_item_id ?? resource?.sender_item_id ?? null;
}

export function parsePayPalWebhookEvent(payload: unknown): PayPalWebhookEvent | null {
  const parsed = webhookEventSchema.safeParse(payload);
  if (!parsed.success) return null;

  return {
    id: parsed.data.id,
    eventType: parsed.data.event_type,
    resource: parsed.data.resource,
  };
}
