import "server-only";
import type { EvidenceAuditDecision } from "@/lib/agents/audit";
import type { AuditSubject, EvidenceAuditJobStore } from "@/lib/agents/evidence-audit-job";
import { EVIDENCE_PHOTO_SLOTS, type EvidenceImage, type EvidencePhotoSlot } from "@/lib/agents/ports";
import { EVIDENCE_AUDIT_PROMPT_VERSION } from "@/lib/agents/prompts";
import { ESCALATION_RULES } from "@/lib/agents/rules.config";
import type { EvidenceMediaType } from "@/lib/deals/evidence-upload";
import type {
  EvidenceItem,
  EvidenceSubmissionStore,
} from "@/lib/state-machine/evidence-submission";
import type { DealState } from "@/lib/state-machine/states";
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

const BUCKET = "evidence";

export type AuditStatus = "PENDING" | "RUNNING" | "DONE" | "FAILED";

export type LatestAudit = {
  id: string;
  status: AuditStatus;
  createdAt: Date;
};

export async function uploadEvidencePhoto(
  path: string,
  bytes: Uint8Array,
  mediaType: EvidenceMediaType,
): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .storage.from(BUCKET)
    .upload(path, bytes, { contentType: mediaType, upsert: false });

  if (error) {
    throw new Error(`Could not store ${path}: ${error.message}`);
  }
}

/** Best effort cleanup after a rejected submission. */
export async function removeEvidencePhotos(paths: readonly string[]): Promise<void> {
  if (paths.length === 0) return;

  const { error } = await getSupabaseAdmin().storage.from(BUCKET).remove([...paths]);
  if (error) console.error("Could not remove orphaned evidence photos", error.message);
}

export async function getDealState(dealId: string): Promise<DealState | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("deals")
    .select("state")
    .eq("id", dealId)
    .maybeSingle<{ state: DealState }>();

  if (error) throw new Error(`Could not load the deal: ${error.message}`);
  return data?.state ?? null;
}

/** Rejected uploads since the deal last entered FUNDS_HELD (payment or a mediator request). */
export async function countEvidenceRejections(dealId: string): Promise<number> {
  const { data, error } = await getSupabaseAdmin()
    .from("events")
    .select("to_state")
    .eq("deal_id", dealId)
    .in("to_state", ["FUNDS_HELD", "EVIDENCE_REJECTED"])
    .order("created_at", { ascending: false })
    .returns<{ to_state: DealState }[]>();

  if (error) throw new Error(`Could not count evidence rejections: ${error.message}`);

  const rows = data ?? [];
  const sinceFundsHeld = rows.findIndex((row) => row.to_state === "FUNDS_HELD");
  return (sinceFundsHeld === -1 ? rows : rows.slice(0, sinceFundsHeld)).length;
}

export async function getLatestEvidenceAudit(
  dealId: string,
  kind: AuditKind = "EVIDENCE_AUDIT",
): Promise<LatestAudit | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("ai_audits")
    .select("id, status, created_at")
    .eq("deal_id", dealId)
    .eq("kind", kind)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; status: AuditStatus; created_at: string }>();

  if (error) throw new Error(`Could not load the evidence audit: ${error.message}`);
  if (!data) return null;

  return { id: data.id, status: data.status, createdAt: new Date(data.created_at) };
}

type SubmitEvidenceRow = TransitionRpcRow & { audit_id: string };

export class SupabaseEvidenceSubmissionStore implements EvidenceSubmissionStore {
  async submit(
    record: TransitionRecord,
    items: readonly EvidenceItem[],
  ): Promise<{ event: TransitionEvent; auditId: string }> {
    const { data, error } = await getSupabaseAdmin()
      .rpc("submit_evidence", {
        p_deal_id: record.dealId,
        p_from: record.from,
        p_payload: record.payload,
        p_items: items.map((item) => ({
          type: item.slot,
          storage_path: item.storagePath,
          sha256: item.sha256,
          mime_type: item.mediaType,
          size_bytes: item.sizeBytes,
          width: item.width,
          height: item.height,
          exif: item.exif,
        })),
        p_prompt_version: EVIDENCE_AUDIT_PROMPT_VERSION,
      })
      .returns<SubmitEvidenceRow[]>()
      .single<SubmitEvidenceRow>();

    if (error) throw transitionRpcError(record, error);

    return { event: toTransitionEvent(data), auditId: data.audit_id };
  }
}

type EvidenceFileRow = {
  type: EvidencePhotoSlot;
  storage_path: string;
  mime_type: EvidenceMediaType;
};

type AuditSubjectDealRow = {
  state: DealState;
  title: string;
  description: string;
  price_cents: number;
};

export async function downloadEvidencePhoto(path: string): Promise<Uint8Array> {
  const { data, error } = await getSupabaseAdmin().storage.from(BUCKET).download(path);
  if (error || !data) {
    throw new Error(`Could not read ${path}: ${error?.message ?? "empty file"}`);
  }
  return new Uint8Array(await data.arrayBuffer());
}

/** Marks a PENDING audit (or one whose run died) RUNNING. Null when another run owns it. */
export async function claimAuditRun(auditId: string): Promise<{ dealId: string } | null> {
  const staleBefore = new Date(Date.now() - ESCALATION_RULES.stuckAuditAfterMs).toISOString();

  const { data, error } = await getSupabaseAdmin()
    .from("ai_audits")
    .update({ status: "RUNNING", started_at: new Date().toISOString() })
    .eq("id", auditId)
    .or(`status.eq.PENDING,and(status.eq.RUNNING,started_at.lt.${staleBefore})`)
    .select("deal_id")
    .maybeSingle<{ deal_id: string }>();

  if (error) throw new Error(`Could not claim the audit: ${error.message}`);
  return data ? { dealId: data.deal_id } : null;
}

export class SupabaseEvidenceAuditJobStore implements EvidenceAuditJobStore {
  claimAudit(auditId: string): Promise<{ dealId: string } | null> {
    return claimAuditRun(auditId);
  }


  async loadAuditSubject(dealId: string): Promise<AuditSubject | null> {
    const admin = getSupabaseAdmin();

    const [{ data: deal, error: dealError }, { data: files, error: filesError }] =
      await Promise.all([
        admin
          .from("deals")
          .select("state, title, description, price_cents")
          .eq("id", dealId)
          .maybeSingle<AuditSubjectDealRow>(),
        admin
          .from("evidence")
          .select("type, storage_path, mime_type")
          .eq("deal_id", dealId)
          .in("type", [...EVIDENCE_PHOTO_SLOTS])
          .is("superseded_at", null)
          .returns<EvidenceFileRow[]>(),
      ]);

    if (dealError) throw new Error(`Could not load the deal: ${dealError.message}`);
    if (filesError) throw new Error(`Could not load the evidence: ${filesError.message}`);
    if (!deal) return null;

    // Bytes, not URLs, so the provider never reaches our bucket.
    const images: EvidenceImage[] = await Promise.all(
      (files ?? []).map(async (file) => ({
        slot: file.type,
        mediaType: file.mime_type,
        data: await downloadEvidencePhoto(file.storage_path),
      })),
    );

    return {
      dealState: deal.state,
      input: {
        title: deal.title,
        description: deal.description,
        priceCents: deal.price_cents,
      },
      images,
    };
  }

  async recordAudit(
    auditId: string,
    decision: EvidenceAuditDecision,
    modelId: string | null,
  ): Promise<void> {
    const { error } = await getSupabaseAdmin()
      .from("ai_audits")
      .update({
        status: decision.audit ? "DONE" : "FAILED",
        model: modelId,
        result: decision.audit,
        inconsistencies: decision.audit?.inconsistencies ?? [],
        triggered_rules: decision.triggeredRules,
        error: decision.technicalError ?? null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", auditId);

    if (error) throw new Error(`Could not record the audit: ${error.message}`);
  }
}

export type AuditKind = "EVIDENCE_AUDIT" | "ARBITRATION";

export type AuditToResume = {
  id: string;
  dealId: string;
  kind: AuditKind;
};

/** Audits whose run died. */
export async function listStuckAudits(limit: number): Promise<AuditToResume[]> {
  const staleBefore = new Date(Date.now() - ESCALATION_RULES.stuckAuditAfterMs).toISOString();

  const { data, error } = await getSupabaseAdmin()
    .from("ai_audits")
    .select("id, deal_id, kind")
    .or(
      `and(status.eq.PENDING,created_at.lt.${staleBefore}),and(status.eq.RUNNING,started_at.lt.${staleBefore})`,
    )
    .order("created_at", { ascending: true })
    .limit(limit)
    .returns<{ id: string; deal_id: string; kind: AuditKind }[]>();

  if (error) throw new Error(`Could not list stuck audits: ${error.message}`);
  return (data ?? []).map((row) => ({ id: row.id, dealId: row.deal_id, kind: row.kind }));
}

export type FinishedAuditRow = {
  id: string;
  dealId: string;
  priceCents: number;
  result: unknown;
  error: string | null;
};

/** Finished audits whose run died before moving the deal. */
export async function listFinishedAuditsAwaitingDecision(
  limit: number,
): Promise<FinishedAuditRow[]> {
  const settledBefore = new Date(Date.now() - 60_000).toISOString();

  const { data, error } = await getSupabaseAdmin()
    .from("ai_audits")
    .select("id, deal_id, result, error, completed_at, deals!inner(state, price_cents)")
    .eq("kind", "EVIDENCE_AUDIT")
    .in("status", ["DONE", "FAILED"])
    .eq("deals.state", "AUDITING")
    .lt("completed_at", settledBefore)
    .order("completed_at", { ascending: false })
    .limit(limit)
    .returns<
      {
        id: string;
        deal_id: string;
        result: unknown;
        error: string | null;
        deals: { state: DealState; price_cents: number };
      }[]
    >();

  if (error) throw new Error(`Could not list finished audits: ${error.message}`);

  const seen = new Set<string>();
  return (data ?? [])
    .filter((row) => (seen.has(row.deal_id) ? false : (seen.add(row.deal_id), true)))
    .map((row) => ({
      id: row.id,
      dealId: row.deal_id,
      priceCents: row.deals.price_cents,
      result: row.result,
      error: row.error,
    }));
}
