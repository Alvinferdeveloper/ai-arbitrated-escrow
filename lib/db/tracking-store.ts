import "server-only";
import { TRACKING_MAX_ATTEMPTS } from "@/lib/config";
import type { TrackingStore, TrackingTarget } from "@/lib/paypal/tracking-sync";
import { getSupabaseAdmin } from "./server";

type DealRow = {
  id: string;
  carrier: string | null;
  tracking_number: string | null;
  tracking_attempts: number;
};

type CaptureRow = {
  paypal_order_id: string | null;
  paypal_capture_id: string | null;
};

const ERROR_MAX = 500;

export class SupabaseTrackingStore implements TrackingStore {
  async load(dealId: string): Promise<TrackingTarget | null> {
    const admin = getSupabaseAdmin();
    const { data: deal, error } = await admin
      .from("deals")
      .select("id, carrier, tracking_number, tracking_attempts")
      .eq("id", dealId)
      .eq("state", "SHIPPED")
      .is("tracking_registered_at", null)
      .maybeSingle<DealRow>();

    if (error) throw new Error(`Could not load the deal tracking: ${error.message}`);
    if (!deal || deal.tracking_attempts >= TRACKING_MAX_ATTEMPTS) return null;

    const { data: capture, error: captureError } = await admin
      .from("payments")
      .select("paypal_order_id, paypal_capture_id")
      .eq("deal_id", dealId)
      .eq("purpose", "CAPTURE")
      .maybeSingle<CaptureRow>();

    if (captureError) {
      throw new Error(`Could not load the deal capture: ${captureError.message}`);
    }

    return {
      dealId,
      orderId: capture?.paypal_order_id ?? null,
      captureId: capture?.paypal_capture_id ?? null,
      carrier: deal.carrier,
      trackingNumber: deal.tracking_number,
    };
  }

  async markRegistered(dealId: string, trackerId: string | null): Promise<void> {
    const { error } = await getSupabaseAdmin()
      .from("deals")
      .update({
        paypal_tracker_id: trackerId,
        tracking_registered_at: new Date().toISOString(),
        tracking_error: null,
      })
      .eq("id", dealId);

    if (error) throw new Error(`Could not store the tracker: ${error.message}`);
  }

  async markFailed(dealId: string, message: string): Promise<void> {
    const admin = getSupabaseAdmin();
    const { data, error: readError } = await admin
      .from("deals")
      .select("tracking_attempts")
      .eq("id", dealId)
      .single<{ tracking_attempts: number }>();

    if (readError) throw new Error(`Could not read the tracking attempts: ${readError.message}`);

    const { error } = await admin
      .from("deals")
      .update({
        tracking_attempts: data.tracking_attempts + 1,
        tracking_error: message.slice(0, ERROR_MAX),
      })
      .eq("id", dealId);

    if (error) throw new Error(`Could not record the tracking failure: ${error.message}`);
  }
}

/** Shipped deals whose tracking is not in PayPal yet and still has attempts left. */
export async function listPendingTracking(limit: number): Promise<string[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("deals")
    .select("id")
    .eq("state", "SHIPPED")
    .is("tracking_registered_at", null)
    .lt("tracking_attempts", TRACKING_MAX_ATTEMPTS)
    .order("shipped_at", { ascending: true })
    .limit(limit)
    .returns<{ id: string }[]>();

  if (error) throw new Error(`Could not list pending tracking: ${error.message}`);
  return data.map((row) => row.id);
}
