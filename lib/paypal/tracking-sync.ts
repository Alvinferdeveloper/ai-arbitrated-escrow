import { buildTracker, trackerId } from "./tracking";

// Registers a shipped deal's guide on the buyer's PayPal capture. It never
// moves money or state: a failure is recorded and retried by the cron.

export type TrackingTarget = {
  dealId: string;
  orderId: string | null;
  captureId: string | null;
  carrier: string | null;
  trackingNumber: string | null;
};

export interface TrackingStore {
  /** Null when the deal is not SHIPPED or its tracking is already registered. */
  load(dealId: string): Promise<TrackingTarget | null>;
  markRegistered(dealId: string, trackerId: string | null): Promise<void>;
  markFailed(dealId: string, error: string): Promise<void>;
}

export interface TrackingGateway {
  addTracking(orderId: string, body: Record<string, unknown>, requestId: string): Promise<unknown>;
}

export type TrackingOutcome = "REGISTERED" | "SKIPPED" | "FAILED";

export async function registerTracking(
  dealId: string,
  store: TrackingStore,
  gateway: TrackingGateway,
): Promise<TrackingOutcome> {
  const target = await store.load(dealId);
  if (!target) return "SKIPPED";

  try {
    if (!target.orderId) throw new Error("The deal has no PayPal order.");

    const body = buildTracker({
      captureId: target.captureId ?? "",
      carrier: target.carrier ?? "",
      trackingNumber: target.trackingNumber ?? "",
    });
    const order = await gateway.addTracking(target.orderId, body, `tracking-${dealId}`);

    await store.markRegistered(dealId, trackerId(order));
    return "REGISTERED";
  } catch (error) {
    await store.markFailed(dealId, error instanceof Error ? error.message : String(error));
    return "FAILED";
  }
}
