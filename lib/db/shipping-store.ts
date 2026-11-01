import "server-only";
import { evidenceAuditSchema } from "@/lib/agents/schemas";
import { AUTO_RELEASE_GRACE_MS, DELIVERY_DAY_MS } from "@/lib/config";
import type { Shipment, ShippingStore } from "@/lib/state-machine/shipping";
import type {
  TransitionEvent,
  TransitionRecord,
} from "@/lib/state-machine/transition";
import { getSupabaseAdmin } from "./server";
import {
  toTransitionEvent,
  transitionRpcError,
  type TransitionRpcRow,
} from "./transition-store";

export class SupabaseShippingStore implements ShippingStore {
  async ship(record: TransitionRecord, shipment: Shipment): Promise<TransitionEvent> {
    const { data, error } = await getSupabaseAdmin()
      .rpc("ship_deal", {
        p_deal_id: record.dealId,
        p_from: record.from,
        p_actor: record.actor,
        p_payload: record.payload,
        p_carrier: shipment.carrier,
        p_tracking_number: shipment.trackingNumber,
        p_day_ms: DELIVERY_DAY_MS,
        p_grace_ms: AUTO_RELEASE_GRACE_MS,
      })
      .returns<TransitionRpcRow[]>()
      .single<TransitionRpcRow>();

    if (error) throw transitionRpcError(record, error);

    return toTransitionEvent(data);
  }
}

/** The guide's carrier and tracking number from the latest finished audit. */
export async function loadAuditedShipment(dealId: string): Promise<Shipment> {
  const { data, error } = await getSupabaseAdmin()
    .from("ai_audits")
    .select("result")
    .eq("deal_id", dealId)
    .eq("kind", "EVIDENCE_AUDIT")
    .eq("status", "DONE")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ result: unknown }>();

  if (error) {
    throw new Error(`Could not load the audited shipment: ${error.message}`);
  }

  const parsed = evidenceAuditSchema.safeParse(data?.result);
  if (!parsed.success) return { carrier: null, trackingNumber: null };

  return {
    carrier: parsed.data.guide.carrier,
    trackingNumber: parsed.data.guide.trackingNumber,
  };
}
