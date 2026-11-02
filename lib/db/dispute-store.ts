import "server-only";
import type { ArbitrationDecision } from "@/lib/agents/arbitration";
import type { ArbitrationJobStore, ArbitrationSubject } from "@/lib/agents/arbitration-job";
import type { ArbitrationImage, ArbitrationImageRole } from "@/lib/agents/ports";
import { ARBITRATION_PROMPT_VERSION } from "@/lib/agents/prompts";
import { storedEvidenceAuditSchema } from "@/lib/agents/schemas";
import type { EvidenceMediaType } from "@/lib/deals/evidence-upload";
import type { EvidenceSlot } from "@/lib/deals/types";
import type {
  ArbitrationOutcomeStore,
  QueueArbitrationSettlementInput,
} from "@/lib/state-machine/arbitration-outcome";
import type { DisputeStore } from "@/lib/state-machine/dispute";
import type { EvidenceItem } from "@/lib/state-machine/evidence-submission";
import {
  MediationConflictError,
  type MediationSettlement,
  type PaymentStatus,
  type SettlementPurpose,
} from "@/lib/state-machine/mediator";
import type { DealState } from "@/lib/state-machine/states";
import {
  DealNotFoundError,
  type TransitionEvent,
  type TransitionRecord,
} from "@/lib/state-machine/transition";
import { claimAuditRun, downloadEvidencePhoto } from "./evidence-store";
import { getSupabaseAdmin } from "./server";
import {
  SupabaseTransitionStore,
  toTransitionEvent,
  transitionRpcError,
  type TransitionRpcRow,
} from "./transition-store";

export class DisputeUnavailableError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "DisputeUnavailableError";
  }
}

const DISPUTE_ERROR_CODES = [
  "dispute_window_closed",
  "settlement_already_queued",
  "no_open_dispute",
  "invalid_reason",
];

type RpcError = { code?: string; message: string; details?: string | null };

function disputeRpcError(record: TransitionRecord, error: RpcError): Error {
  const known = DISPUTE_ERROR_CODES.find((code) => error.message.includes(code));
  return known ? new DisputeUnavailableError(known) : transitionRpcError(record, error);
}

export class SupabaseDisputeStore implements DisputeStore {
  async openDispute(record: TransitionRecord, reason: string): Promise<TransitionEvent> {
    const { data, error } = await getSupabaseAdmin()
      .rpc("open_dispute", {
        p_deal_id: record.dealId,
        p_reason: reason,
        p_payload: record.payload,
      })
      .returns<TransitionRpcRow[]>()
      .single<TransitionRpcRow>();

    if (error) throw disputeRpcError(record, error);
    return toTransitionEvent(data);
  }

  async submitUnboxing(
    record: TransitionRecord,
    item: EvidenceItem,
  ): Promise<{ event: TransitionEvent; auditId: string }> {
    const { data, error } = await getSupabaseAdmin()
      .rpc("submit_unboxing", {
        p_deal_id: record.dealId,
        p_payload: record.payload,
        p_item: {
          type: item.slot,
          storage_path: item.storagePath,
          sha256: item.sha256,
          mime_type: item.mediaType,
          size_bytes: item.sizeBytes,
          width: item.width,
          height: item.height,
          exif: item.exif,
        },
        p_prompt_version: ARBITRATION_PROMPT_VERSION,
      })
      .returns<(TransitionRpcRow & { audit_id: string })[]>()
      .single<TransitionRpcRow & { audit_id: string }>();

    if (error) throw disputeRpcError(record, error);
    return { event: toTransitionEvent(data), auditId: data.audit_id };
  }
}

type SettlementRow = {
  payment_id: string;
  purpose: SettlementPurpose;
  status: PaymentStatus;
  idempotency_key: string;
};

export class SupabaseArbitrationOutcomeStore
  extends SupabaseTransitionStore
  implements ArbitrationOutcomeStore
{
  async queueArbitrationSettlement(
    input: QueueArbitrationSettlementInput,
  ): Promise<MediationSettlement> {
    const { data, error } = await getSupabaseAdmin()
      .rpc("queue_arbitration_settlement", {
        p_deal_id: input.dealId,
        p_purpose: input.outcome === "RELEASE" ? "PAYOUT" : "REFUND",
        p_reason: input.reason,
        p_idempotency_key: input.idempotencyKey,
      })
      .returns<SettlementRow[]>()
      .single<SettlementRow>();

    if (error) {
      if (error.code === "P0002") throw new DealNotFoundError(input.dealId);
      if (error.code === "40001") {
        throw new MediationConflictError(input.dealId, error.details || error.message);
      }
      throw new Error(`Supabase arbitration settlement failed: ${error.message}`);
    }

    return {
      paymentId: data.payment_id,
      purpose: data.purpose,
      status: data.status,
      idempotencyKey: data.idempotency_key,
    };
  }
}

const IMAGE_ROLES: Partial<Record<EvidenceSlot, ArbitrationImageRole>> = {
  A: "SELLER_PRODUCT",
  C: "SELLER_PARCEL",
  D: "BUYER_UNBOXING",
};

type ArbitrationDealRow = {
  state: DealState;
  title: string;
  description: string;
  price_cents: number;
};

type EvidenceFileRow = {
  type: EvidenceSlot;
  storage_path: string;
  mime_type: EvidenceMediaType;
};

/** The latest finished evidence audit, validated. Null when missing or invalid. */
export async function loadSellerAudit(dealId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("ai_audits")
    .select("result")
    .eq("deal_id", dealId)
    .eq("kind", "EVIDENCE_AUDIT")
    .eq("status", "DONE")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ result: unknown }>();

  if (error) throw new Error(`Could not load the seller audit: ${error.message}`);
  const parsed = storedEvidenceAuditSchema.safeParse(data?.result);
  return parsed.success ? parsed.data : null;
}

export class SupabaseArbitrationJobStore implements ArbitrationJobStore {
  claimAudit(auditId: string): Promise<{ dealId: string } | null> {
    return claimAuditRun(auditId);
  }

  async loadArbitrationSubject(dealId: string): Promise<ArbitrationSubject | null> {
    const admin = getSupabaseAdmin();

    const [
      { data: deal, error: dealError },
      { data: dispute, error: disputeError },
      { data: files, error: filesError },
      sellerAudit,
    ] = await Promise.all([
      admin
        .from("deals")
        .select("state, title, description, price_cents")
        .eq("id", dealId)
        .maybeSingle<ArbitrationDealRow>(),
      admin
        .from("disputes")
        .select("reason")
        .eq("deal_id", dealId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<{ reason: string }>(),
      admin
        .from("evidence")
        .select("type, storage_path, mime_type")
        .eq("deal_id", dealId)
        .in("type", Object.keys(IMAGE_ROLES))
        .is("superseded_at", null)
        .returns<EvidenceFileRow[]>(),
      loadSellerAudit(dealId),
    ]);

    if (dealError) throw new Error(`Could not load the deal: ${dealError.message}`);
    if (disputeError) throw new Error(`Could not load the dispute: ${disputeError.message}`);
    if (filesError) throw new Error(`Could not load the evidence: ${filesError.message}`);
    if (!deal) return null;

    // Seller photos first, then the buyer's, as the prompt describes.
    const ordered = [...(files ?? [])].sort((a, b) => a.type.localeCompare(b.type));
    const images: ArbitrationImage[] = await Promise.all(
      ordered.flatMap((file) => {
        const role = IMAGE_ROLES[file.type];
        if (!role) return [];
        return [
          downloadEvidencePhoto(file.storage_path).then((data) => ({
            role,
            mediaType: file.mime_type,
            data,
          })),
        ];
      }),
    );

    return {
      dealState: deal.state,
      input: sellerAudit
        ? {
            title: deal.title,
            description: deal.description,
            priceCents: deal.price_cents,
            disputeReason: dispute?.reason ?? "",
            sellerAudit,
          }
        : null,
      images,
    };
  }

  async recordArbitration(
    auditId: string,
    decision: ArbitrationDecision,
    modelId: string | null,
  ): Promise<void> {
    const { error } = await getSupabaseAdmin()
      .from("ai_audits")
      .update({
        status: decision.buyerAudit ? "DONE" : "FAILED",
        model: modelId,
        result: decision.buyerAudit,
        inconsistencies: decision.buyerAudit?.inconsistencies ?? [],
        triggered_rules: decision.triggeredRules,
        error: decision.technicalError ?? null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", auditId);

    if (error) throw new Error(`Could not record the arbitration: ${error.message}`);
  }
}

export type FinishedArbitrationRow = { id: string; dealId: string; result: unknown };

/** Finished arbitrations whose run died before applying the verdict. */
export async function listFinishedArbitrationsAwaitingDecision(
  limit: number,
): Promise<FinishedArbitrationRow[]> {
  const settledBefore = new Date(Date.now() - 60_000).toISOString();

  const { data, error } = await getSupabaseAdmin()
    .from("ai_audits")
    .select("id, deal_id, result, deals!inner(state)")
    .eq("kind", "ARBITRATION")
    .in("status", ["DONE", "FAILED"])
    .eq("deals.state", "ARBITRATING")
    .lt("completed_at", settledBefore)
    .order("completed_at", { ascending: false })
    .limit(limit)
    .returns<{ id: string; deal_id: string; result: unknown }[]>();

  if (error) throw new Error(`Could not list finished arbitrations: ${error.message}`);
  return (data ?? []).map((row) => ({ id: row.id, dealId: row.deal_id, result: row.result }));
}

/** The pending or finished payout/refund of a deal, for the screens. */
export async function getDealSettlement(
  dealId: string,
): Promise<{ purpose: SettlementPurpose; status: PaymentStatus } | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("payments")
    .select("purpose, status")
    .eq("deal_id", dealId)
    .in("purpose", ["PAYOUT", "REFUND"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ purpose: SettlementPurpose; status: PaymentStatus }>();

  if (error) throw new Error(`Could not load the settlement: ${error.message}`);
  return data;
}
