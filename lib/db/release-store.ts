import "server-only";
import { randomUUID } from "node:crypto";
import { getSupabaseAdmin } from "./server";

// Payout requests for FR7: the buyer confirms receipt, or the auto-release
// cron reaches the deadline. The row is written before PayPal is called and is
// reused on retries, so a double click never pays twice.

export type ReleaseRequest = {
  paymentId: string;
  status: string;
  idempotencyKey: string;
};

export class ReleaseUnavailableError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "ReleaseUnavailableError";
  }
}

type ReleaseRow = {
  payment_id: string;
  purpose: string;
  status: string;
  idempotency_key: string;
  created_at: string;
};

export async function requestRelease(dealId: string): Promise<ReleaseRequest> {
  const idempotencyKey = `release-${dealId}-${randomUUID()}`;

  const { data, error } = await getSupabaseAdmin()
    .rpc("request_release", {
      p_deal_id: dealId,
      p_idempotency_key: idempotencyKey,
    })
    .returns<ReleaseRow[]>()
    .single<ReleaseRow>();

  if (error) {
    const known = [
      "deal_not_found",
      "deal_not_shipped",
      "settlement_already_queued",
      "invalid_idempotency_key",
    ].find((code) => error.message.includes(code));

    if (known) throw new ReleaseUnavailableError(known);

    throw new Error(`Supabase request_release failed: ${error.message}`);
  }

  if (!data) {
    throw new Error("Supabase request_release returned no payment");
  }

  return {
    paymentId: data.payment_id,
    status: data.status,
    idempotencyKey: data.idempotency_key,
  };
}

type DueDealRow = {
  id: string;
  auto_release_at: string;
};

/** Shipped deals whose auto-release deadline has passed, oldest first. */
export async function listDueReleases(limit = 25): Promise<DueDealRow[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("deals")
    .select("id, auto_release_at")
    .eq("state", "SHIPPED")
    .eq("is_example", false)
    .not("auto_release_at", "is", null)
    .lte("auto_release_at", new Date().toISOString())
    .order("auto_release_at", { ascending: true })
    .limit(limit)
    .returns<DueDealRow[]>();

  if (error) {
    throw new Error(`Could not load due releases: ${error.message}`);
  }

  return data ?? [];
}
