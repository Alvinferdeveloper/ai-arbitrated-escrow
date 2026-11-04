import "server-only";
import {
  ESCALATION_RULE_IDS,
  ESCALATION_RULE_LABELS,
  type EscalationRuleId,
} from "@/lib/agents/rules.config";
import { toAuditReportView } from "@/lib/agents/report";
import { storedEvidenceAuditSchema } from "@/lib/agents/schemas";
import { EVIDENCE_SLOT_COPY } from "@/lib/deals/evidence";
import type {
  AuditReportView,
  DealParty,
  EvidenceSlot,
  EvidenceView,
} from "@/lib/deals/types";
import { formatCaseAge } from "@/lib/mediation/age";
import type {
  MediationCase,
  MediationQueueRow,
  MediationTimelineActor,
  MediationTimelineEntry,
} from "@/lib/mediation/types";
import type { Actor, DealState } from "@/lib/state-machine/states";
import { getSupabaseAdmin } from "./server";

// Read models for the mediator desk. Everything is scoped by the service-role
// client; the queue only asks for ESCALATED deals and the case page refuses to
// show a deal after it left the mediator.

type DealRow = {
  id: string;
  seller_id: string;
  buyer_id: string;
  title: string;
  price_cents: number;
  state: DealState;
  created_at: string;
  updated_at: string;
  /** Only selected by the case loader. */
  shipped_at?: string | null;
  verification_code?: string | null;
  is_sample?: boolean;
};

type UserRow = {
  id: string;
  display_name: string;
};

type EvidenceRow = {
  id: string;
  type: EvidenceSlot;
  storage_path: string;
  created_at: string;
};

type AuditRow = {
  id: string;
  result: unknown;
  triggered_rules: string[];
  created_at: string;
};

type DisputeRow = {
  id: string;
  reason: string;
  status: "OPEN" | "DECIDED";
  created_at: string;
};

type SettlementRow = {
  id: string;
  purpose: "PAYOUT" | "REFUND";
  status: string;
  created_at: string;
};

type EventRow = {
  id: number | string;
  actor: Actor;
  from_state: DealState | null;
  to_state: DealState;
  payload: Record<string, unknown> | null;
  created_at: string;
};

function fail(context: string, message: string): never {
  throw new Error(`${context}: ${message}`);
}

function isRule(value: unknown): value is EscalationRuleId {
  return (
    typeof value === "string" &&
    (ESCALATION_RULE_IDS as readonly string[]).includes(value)
  );
}

type AuditRuleSource = {
  triggered_rules: string[];
};

function ruleFromAudit(audit: AuditRuleSource | null): EscalationRuleId | null {
  if (!audit) return null;
  return audit.triggered_rules.find(isRule) ?? null;
}

function ruleFromEvent(event: EventRow | null): EscalationRuleId | null {
  const rule = event?.payload?.rule;
  return isRule(rule) ? rule : null;
}

function pickReason(
  audit: AuditRuleSource | null,
  escalatedEvent: EventRow | null,
): EscalationRuleId {
  return (
    ruleFromEvent(escalatedEvent) ??
    ruleFromAudit(audit) ??
    "TECHNICAL_FAILURE"
  );
}

function payloadText(event: EventRow | null, key: string): string | null {
  const value = event?.payload?.[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function party(user: UserRow | undefined, fallback: string): DealParty {
  return {
    id: user?.id ?? fallback,
    displayName: user?.display_name ?? "Unknown user",
  };
}

function userMap(users: UserRow[]): Map<string, UserRow> {
  return new Map(users.map((user) => [user.id, user]));
}

function latestByDeal<T extends { deal_id: string; created_at: string }>(
  rows: T[],
): Map<string, T> {
  const map = new Map<string, T>();

  for (const row of rows) {
    if (!map.has(row.deal_id)) map.set(row.deal_id, row);
  }

  return map;
}

async function loadUsers(ids: string[]): Promise<UserRow[]> {
  if (ids.length === 0) return [];

  const { data, error } = await getSupabaseAdmin()
    .from("users")
    .select("id, display_name")
    .in("id", [...new Set(ids)])
    .returns<UserRow[]>();

  if (error) fail("Could not load users", error.message);
  return data ?? [];
}

export async function listMediationQueue(
  now: Date = new Date(),
): Promise<MediationQueueRow[]> {
  const admin = getSupabaseAdmin();
  const { data: deals, error } = await admin
    .from("deals")
    .select(
      "id, seller_id, buyer_id, title, price_cents, state, created_at, updated_at",
    )
    .eq("state", "ESCALATED")
    .order("updated_at", { ascending: true })
    .returns<DealRow[]>();

  if (error) fail("Could not load the mediation queue", error.message);
  if (!deals || deals.length === 0) return [];

  const dealIds = deals.map((deal) => deal.id);

  const [{ data: users, error: usersError }, { data: audits, error: auditsError }, { data: events, error: eventsError }] =
    await Promise.all([
      admin
        .from("users")
        .select("id, display_name")
        .in("id", [...new Set(deals.flatMap((deal) => [deal.seller_id, deal.buyer_id]))])
        .returns<UserRow[]>(),
      admin
        .from("ai_audits")
        .select("deal_id, triggered_rules, created_at")
        .in("deal_id", dealIds)
        .eq("kind", "EVIDENCE_AUDIT")
        .eq("status", "DONE")
        .order("created_at", { ascending: false })
        .returns<(AuditRuleSource & { deal_id: string; created_at: string })[]>(),
      admin
        .from("events")
        .select("deal_id, actor, from_state, to_state, payload, created_at")
        .in("deal_id", dealIds)
        .eq("to_state", "ESCALATED")
        .order("created_at", { ascending: false })
        .returns<(EventRow & { deal_id: string })[]>(),
    ]);

  if (usersError) fail("Could not load queue users", usersError.message);
  if (auditsError) fail("Could not load queue audits", auditsError.message);
  if (eventsError) fail("Could not load queue events", eventsError.message);

  const usersById = userMap(users ?? []);
  const auditByDeal = latestByDeal(audits ?? []);
  const eventByDeal = latestByDeal(events ?? []);

  return deals.map((deal) => {
    const buyer = usersById.get(deal.buyer_id);
    const reason = pickReason(
      auditByDeal.get(deal.id) ?? null,
      eventByDeal.get(deal.id) ?? null,
    );

    return {
      id: deal.id,
      title: deal.title,
      buyerName: buyer?.display_name ?? "Unknown buyer",
      amountCents: deal.price_cents,
      reason,
      reasonLabel: ESCALATION_RULE_LABELS[reason],
      age: formatCaseAge(new Date(deal.updated_at), now),
      state: "ESCALATED",
    };
  });
}

async function signedEvidenceUrl(path: string): Promise<string | null> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .storage.from("evidence")
      .createSignedUrl(path, 10 * 60);

    if (error) return null;
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}

function evidenceView(
  row: EvidenceRow,
  imageUrl: string | null,
): EvidenceView {
  return {
    slot: row.type,
    ...EVIDENCE_SLOT_COPY[row.type],
    status: "uploaded",
    uploadedAt: new Date(row.created_at),
    imageUrl,
  };
}

function eventTitle(event: EventRow): string {
  const explicit = payloadText(event, "title");
  if (explicit) return explicit;

  if (payloadText(event, "decision") === "REQUEST_EVIDENCE") {
    return "More evidence requested";
  }

  switch (event.to_state) {
    case "AWAITING_PAYMENT":
      return "Checkout started";
    case "FUNDS_HELD":
      return "Payment captured";
    case "AUDITING":
      return "Evidence audit started";
    case "EVIDENCE_REJECTED":
      return "Evidence rejected";
    case "SHIPPED":
      return "Marked as shipped";
    case "DISPUTED":
      return "Buyer opened a dispute";
    case "ARBITRATING":
      return "Arbitration started";
    case "ESCALATED":
      return "Escalated to a mediator";
    case "REFUNDING":
      return "Cancelled by the AI";
    case "RELEASED":
      return "Payment released";
    case "REFUNDED":
      return "Refund completed";
  }
}

function eventDetail(event: EventRow): string {
  const explicit = payloadText(event, "detail");
  if (explicit) return explicit;

  if (payloadText(event, "decision") === "REQUEST_EVIDENCE") {
    const target = payloadText(event, "target");
    return target === "BUYER"
      ? "The mediator asked the buyer for more unboxing evidence. The money stays held."
      : "The mediator asked the seller for more evidence. The money stays held.";
  }

  switch (event.to_state) {
    case "AWAITING_PAYMENT":
      return "The buyer has not paid yet.";
    case "FUNDS_HELD":
      return "The platform holds the payment while the deal runs.";
    case "AUDITING":
      return "The model is checking photos A, B and C.";
    case "EVIDENCE_REJECTED":
      return "The seller can upload new photos.";
    case "SHIPPED":
      return "The seller attached shipment details.";
    case "DISPUTED":
      return "The buyer added unboxing evidence.";
    case "ARBITRATING":
      return "The system is comparing both sides of the dispute.";
    case "ESCALATED":
      return "A rule sent this case to a person.";
    case "REFUNDING":
      return "The AI cancelled the deal and sent the refund to PayPal.";
    case "RELEASED":
      return "PayPal confirmed the payout.";
    case "REFUNDED":
      return "PayPal confirmed the refund.";
  }
}

function timelineActor(actor: Actor): MediationTimelineActor {
  return actor === "paypal" ? "system" : actor;
}

function timelineEntry(event: EventRow): MediationTimelineEntry {
  return {
    id: String(event.id),
    at: new Date(event.created_at),
    actor: timelineActor(event.actor),
    title: eventTitle(event),
    detail: eventDetail(event),
  };
}

export async function getMediationCase(
  id: string,
): Promise<MediationCase | null> {
  const admin = getSupabaseAdmin();
  const { data: deal, error } = await admin
    .from("deals")
    .select(
      "id, seller_id, buyer_id, title, price_cents, state, created_at, updated_at, shipped_at, verification_code, is_sample",
    )
    .eq("id", id)
    .maybeSingle<DealRow>();

  if (error) fail("Could not load the case", error.message);
  if (!deal || deal.state !== "ESCALATED") return null;

  const [
    { data: evidence, error: evidenceError },
    { data: audit, error: auditError },
    { data: dispute, error: disputeError },
    { data: events, error: eventsError },
    { data: settlement, error: settlementError },
    users,
  ] = await Promise.all([
    admin
      .from("evidence")
      .select("id, type, storage_path, created_at")
      .eq("deal_id", deal.id)
      .is("superseded_at", null)
      .order("created_at", { ascending: true })
      .returns<EvidenceRow[]>(),
    admin
      .from("ai_audits")
      .select("id, result, triggered_rules, created_at")
      .eq("deal_id", deal.id)
      .eq("kind", "EVIDENCE_AUDIT")
      .eq("status", "DONE")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<AuditRow>(),
    admin
      .from("disputes")
      .select("id, reason, status, created_at")
      .eq("deal_id", deal.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<DisputeRow>(),
    admin
      .from("events")
      .select("id, actor, from_state, to_state, payload, created_at")
      .eq("deal_id", deal.id)
      .order("created_at", { ascending: true })
      .returns<EventRow[]>(),
    admin
      .from("payments")
      .select("id, purpose, status, created_at")
      .eq("deal_id", deal.id)
      .in("purpose", ["PAYOUT", "REFUND"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<SettlementRow>(),
    loadUsers([deal.seller_id, deal.buyer_id]),
  ]);

  if (evidenceError) fail("Could not load case evidence", evidenceError.message);
  if (auditError) fail("Could not load the case audit", auditError.message);
  if (disputeError) fail("Could not load the case dispute", disputeError.message);
  if (eventsError) fail("Could not load the case timeline", eventsError.message);
  if (settlementError) fail("Could not load the case settlement", settlementError.message);

  const usersById = userMap(users);
  const eventRows = events ?? [];
  const escalatedEvent =
    [...eventRows].reverse().find((event) => event.to_state === "ESCALATED") ??
    null;

  const reason = pickReason(audit ?? null, escalatedEvent);
  const reasonLabel = ESCALATION_RULE_LABELS[reason];
  const auditInconsistencies =
    audit?.result && typeof audit.result === "object"
      ? (audit.result as { inconsistencies?: unknown }).inconsistencies
      : undefined;
  const firstInconsistency = Array.isArray(auditInconsistencies)
    ? auditInconsistencies.find(
        (item): item is string => typeof item === "string" && item.trim() !== "",
      )
    : undefined;
  const claim =
    dispute?.reason ??
    payloadText(escalatedEvent, "claim") ??
    "No buyer statement was recorded.";
  const reasonDetail =
    payloadText(escalatedEvent, "reasonDetail") ??
    firstInconsistency ??
    `${reasonLabel} sent this case to a person.`;
  const summary =
    payloadText(escalatedEvent, "summary") ??
    `${reasonLabel} was recorded. ${claim}`;

  const parsedAudit = audit?.result
    ? storedEvidenceAuditSchema.safeParse(audit.result)
    : null;
  const auditView: AuditReportView | null =
    parsedAudit?.success === true
      ? toAuditReportView(parsedAudit.data, audit?.triggered_rules ?? [], {
          verificationCode: deal.verification_code ?? null,
          isSample: deal.is_sample ?? false,
        })
      : null;

  const evidenceRows = evidence ?? [];
  const signedUrls = await Promise.all(
    evidenceRows.map((row) => signedEvidenceUrl(row.storage_path)),
  );
  const evidenceViews = evidenceRows.map((row, index) =>
    evidenceView(row, signedUrls[index] ?? null),
  );

  return {
    id: deal.id,
    state: "ESCALATED",
    title: deal.title,
    priceCents: deal.price_cents,
    seller: party(usersById.get(deal.seller_id), deal.seller_id),
    buyer: party(usersById.get(deal.buyer_id), deal.buyer_id),
    reason,
    reasonDetail,
    summary,
    claim,
    openedAt: escalatedEvent
      ? new Date(escalatedEvent.created_at)
      : new Date(deal.updated_at),
    sellerEvidence: evidenceViews.filter((item) => item.slot !== "D"),
    buyerEvidence: evidenceViews.filter((item) => item.slot === "D"),
    audit: auditView,
    settlement: settlement
      ? {
          purpose: settlement.purpose,
          status: settlement.status,
          createdAt: new Date(settlement.created_at),
        }
      : null,
    canApproveShipping: !deal.shipped_at && dispute?.status !== "OPEN",
    timeline: eventRows.map(timelineEntry),
  };
}
