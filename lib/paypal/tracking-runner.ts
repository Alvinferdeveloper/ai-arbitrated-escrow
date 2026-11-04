import "server-only";
import { SupabaseTrackingStore } from "@/lib/db/tracking-store";
import { paypalRequest } from "./client";
import { isPayPalConfigured } from "./config";
import { registerTracking, type TrackingGateway, type TrackingOutcome } from "./tracking-sync";

const gateway: TrackingGateway = {
  addTracking: (orderId, body, requestId) =>
    paypalRequest<unknown>({
      method: "POST",
      path: `/v2/checkout/orders/${encodeURIComponent(orderId)}/track`,
      requestId,
      body,
    }),
};

/** Never throws: tracking is informational and must not break shipping. */
export async function registerShipmentTracking(dealId: string): Promise<TrackingOutcome> {
  if (!isPayPalConfigured()) return "SKIPPED";

  try {
    const outcome = await registerTracking(dealId, new SupabaseTrackingStore(), gateway);
    if (outcome === "FAILED") console.error("PayPal tracking registration failed", dealId);
    return outcome;
  } catch (error) {
    console.error("PayPal tracking registration failed", dealId, error);
    return "FAILED";
  }
}
