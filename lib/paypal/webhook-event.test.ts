import { describe, expect, it } from "vitest";
import {
  captureStatusForEvent,
  isCaptureEvent,
  isPayoutItemEvent,
  parsePayPalWebhookEvent,
  senderItemIdFromResource,
} from "./webhook-event";

describe("parsePayPalWebhookEvent", () => {
  it("parses a capture completed event", () => {
    const event = parsePayPalWebhookEvent({
      id: "evt-1",
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      resource: {
        id: "cap-1",
        status: "COMPLETED",
        supplementary_data: { related_ids: { order_id: "ord-1" } },
      },
    });

    expect(event).toMatchObject({
      id: "evt-1",
      eventType: "PAYMENT.CAPTURE.COMPLETED",
      resource: expect.objectContaining({ id: "cap-1" }),
    });
  });

  it("ignores extra resource fields", () => {
    const event = parsePayPalWebhookEvent({
      id: "evt-2",
      event_type: "PAYMENT.PAYOUTS-ITEM.SUCCEEDED",
      unknown: true,
      resource: {
        id: "payout-item-1",
        payout_batch_id: "batch-1",
        payout_item: { sender_item_id: "shield-payment-1" },
        totally_new_field: "ok",
      },
    });

    expect(event).toBeDefined();
    expect(event?.resource.payout_batch_id).toBe("batch-1");
    expect(senderItemIdFromResource(event?.resource)).toBe("shield-payment-1");
  });

  it("rejects malformed payloads", () => {
    expect(parsePayPalWebhookEvent(null)).toBeNull();
    expect(parsePayPalWebhookEvent({})).toBeNull();
    expect(parsePayPalWebhookEvent({ id: "evt-3" })).toBeNull();
  });
});

describe("event helpers", () => {
  it("classifies capture and payout events", () => {
    expect(isCaptureEvent("PAYMENT.CAPTURE.COMPLETED")).toBe(true);
    expect(isCaptureEvent("PAYMENT.PAYOUTS-ITEM.SUCCEEDED")).toBe(false);
    expect(isPayoutItemEvent("PAYMENT.PAYOUTS-ITEM.SUCCEEDED")).toBe(true);
    expect(captureStatusForEvent("PAYMENT.CAPTURE.REVERSED")).toBe("REVERSED");
    expect(captureStatusForEvent("CHECKOUT.ORDER.APPROVED")).toBeNull();
  });
});
