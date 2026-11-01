import "server-only";
import { toAuditReportView } from "@/lib/agents/report";
import { evidenceAuditSchema } from "@/lib/agents/schemas";
import { EVIDENCE_SLOT_COPY } from "@/lib/deals/evidence";
import { usdToCents } from "@/lib/deals/money";
import type {
  AuditReportView,
  Deal,
  DealParty,
  DealSummary,
  DealView,
  EvidenceSlot,
  EvidenceView,
} from "@/lib/deals/types";
import type { CreateDealData } from "@/lib/deals/schema";
import type { DealState } from "@/lib/state-machine/states";
import { getSupabaseAdmin } from "./server";

// Server-side deal persistence for the manual create-deal form (FR1) and the
// Trust Link read model (FR2). Service-role client: the actor is checked by
// the RPC before anything is written, and browser clients never see this key.
// checked by the RPC before anything is written.

export type PartyOption = {
  id: string;
  displayName: string;
};

export class InvalidDealError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidDealError";
  }
}

export class DealPartyNotFoundError extends Error {
  constructor(readonly party: "sellerId" | "buyerId") {
    super(`The selected ${party} no longer exists.`);
    this.name = "DealPartyNotFoundError";
  }
}

type CreateDealRow = {
  deal_id: string;
};

export async function createDeal(data: CreateDealData): Promise<string> {
  const { data: row, error } = await getSupabaseAdmin()
    .rpc("create_deal", {
      p_seller_id: data.sellerId,
      p_buyer_id: data.buyerId,
      p_title: data.title,
      p_description: data.description,
      p_price_cents: usdToCents(data.priceUsd),
      p_delivery_estimate_days: data.deliveryEstimateDays,
    })
    .returns<CreateDealRow[]>()
    .single<CreateDealRow>();

  if (error) {
    const message = error.message;

    if (
      message.includes("invalid_title") ||
      message.includes("invalid_price") ||
      message.includes("invalid_delivery_estimate") ||
      message.includes("same_party") ||
      message.includes("seller_not_eligible") ||
      message.includes("buyer_not_eligible")
    ) {
      throw new InvalidDealError(
        "The deal was rejected. Check the title, the price and the delivery estimate.",
      );
    }

    if (message.includes("seller_not_found")) {
      throw new DealPartyNotFoundError("sellerId");
    }

    if (message.includes("buyer_not_found")) {
      throw new DealPartyNotFoundError("buyerId");
    }

    throw new Error(`Supabase create_deal failed: ${message}`);
  }

  const dealId = row?.deal_id;
  if (!dealId) {
    throw new Error("Supabase create_deal returned no deal");
  }

  return dealId;
}

type UserOptionRow = {
  id: string;
  display_name: string;
  role: "seller" | "buyer";
};

export async function listPartyOptions(): Promise<{
  sellers: PartyOption[];
  buyers: PartyOption[];
}> {
  const { data, error } = await getSupabaseAdmin()
    .from("users")
    .select("id, display_name, role")
    .eq("is_demo", true)
    .in("role", ["seller", "buyer"])
    .order("display_name", { ascending: true })
    .returns<UserOptionRow[]>();

  if (error) {
    throw new Error(`Could not load demo users: ${error.message}`);
  }

  const rows = data ?? [];

  return {
    sellers: rows
      .filter((row) => row.role === "seller")
      .map((row) => ({ id: row.id, displayName: row.display_name })),
    buyers: rows
      .filter((row) => row.role === "buyer")
      .map((row) => ({ id: row.id, displayName: row.display_name })),
  };
}

type DealRow = {
  id: string;
  seller_id: string;
  buyer_id: string;
  title: string;
  description: string;
  price_cents: number;
  state: DealState;
  delivery_estimate_days: number | null;
  auto_release_at: string | null;
  carrier: string | null;
  tracking_number: string | null;
  created_at: string;
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

function fail(context: string, message: string): never {
  throw new Error(`${context}: ${message}`);
}

function party(user: UserOptionRow | undefined, fallback: string): DealParty {
  return {
    id: user?.id ?? fallback,
    displayName: user?.display_name ?? "Unknown user",
  };
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

function missingEvidence(slot: EvidenceSlot): EvidenceView {
  return {
    slot,
    ...EVIDENCE_SLOT_COPY[slot],
    status: "missing",
    uploadedAt: null,
    imageUrl: null,
  };
}

function uploadedEvidence(
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

type DealSummaryRow = {
  id: string;
  title: string;
  price_cents: number;
  state: DealState;
  updated_at: string;
  seller: { id: string; display_name: string } | null;
  buyer: { id: string; display_name: string } | null;
};

function summaryParty(
  user: DealSummaryRow["seller"],
  fallback: string,
): DealParty {
  return { id: user?.id ?? fallback, displayName: user?.display_name ?? "Unknown user" };
}

/** Most recently changed deals first. */
export async function listDeals(limit = 50): Promise<DealSummary[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("deals")
    .select(
      "id, title, price_cents, state, updated_at, seller:users!deals_seller_id_fkey(id, display_name), buyer:users!deals_buyer_id_fkey(id, display_name)",
    )
    .order("updated_at", { ascending: false })
    .limit(limit)
    .returns<DealSummaryRow[]>();

  if (error) fail("Could not load the deals", error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    priceCents: row.price_cents,
    state: row.state,
    seller: summaryParty(row.seller, ""),
    buyer: summaryParty(row.buyer, ""),
    updatedAt: new Date(row.updated_at),
  }));
}

/**
 * Public read model for the Trust Link page. Nothing here exposes the
 * service-role client to the browser; the page renders whatever this returns.
 */
export async function getTrustLinkDeal(
  id: string,
): Promise<DealView | null> {
  const admin = getSupabaseAdmin();

  const { data: deal, error: dealError } = await admin
    .from("deals")
    .select(
      "id, seller_id, buyer_id, title, description, price_cents, state, delivery_estimate_days, auto_release_at, carrier, tracking_number, created_at",
    )
    .eq("id", id)
    .maybeSingle<DealRow>();

  if (dealError) fail("Could not load the deal", dealError.message);
  if (!deal) return null;

  const [
    { data: evidenceRows, error: evidenceError },
    { data: audit, error: auditError },
    { data: users, error: usersError },
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
      .from("users")
      .select("id, display_name")
      .in("id", [deal.seller_id, deal.buyer_id])
      .returns<UserOptionRow[]>(),
  ]);

  if (evidenceError) fail("Could not load the deal evidence", evidenceError.message);
  if (auditError) fail("Could not load the deal audit", auditError.message);
  if (usersError) fail("Could not load the deal users", usersError.message);

  const parsedAudit = audit?.result
    ? evidenceAuditSchema.safeParse(audit.result)
    : null;
  const auditView: AuditReportView | null =
    parsedAudit?.success === true
      ? toAuditReportView(parsedAudit.data, audit?.triggered_rules ?? [])
      : null;

  const rows = evidenceRows ?? [];
  const signedUrls = await Promise.all(
    rows.map((row) => signedEvidenceUrl(row.storage_path)),
  );
  const uploaded = new Map(
    rows.map((row, index) => [row.type, uploadedEvidence(row, signedUrls[index] ?? null)]),
  );

  const evidenceViews: EvidenceView[] = (
    ["A", "B", "C", "D"] as EvidenceSlot[]
  ).map((slot) => uploaded.get(slot) ?? missingEvidence(slot));

  const dealBase: Deal = {
    id: deal.id,
    title: deal.title,
    description: deal.description,
    priceCents: deal.price_cents,
    currency: "USD",
    state: deal.state,
    seller: party(
      users?.find((user) => user.id === deal.seller_id),
      deal.seller_id,
    ),
    buyer: party(
      users?.find((user) => user.id === deal.buyer_id),
      deal.buyer_id,
    ),
    deliveryEstimateDays: deal.delivery_estimate_days,
    autoReleaseAt: deal.auto_release_at ? new Date(deal.auto_release_at) : null,
    carrier: deal.carrier,
    trackingNumber: deal.tracking_number,
    createdAt: new Date(deal.created_at),
  };

  return { ...dealBase, evidence: evidenceViews, audit: auditView };
}
