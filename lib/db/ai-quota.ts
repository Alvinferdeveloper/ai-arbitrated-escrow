import "server-only";
import { AI_AUDITS_PER_DEAL, AI_AUDITS_PER_HOUR } from "@/lib/config";
import { getSupabaseAdmin } from "./server";

export type AiQuotaResult = { ok: true } | { ok: false; reason: "DEAL_LIMIT" | "HOURLY_LIMIT" };

async function countAudits(filter: { dealId?: string; since?: Date }): Promise<number> {
  let query = getSupabaseAdmin().from("ai_audits").select("id", { count: "exact", head: true });
  if (filter.dealId) query = query.eq("deal_id", filter.dealId);
  if (filter.since) query = query.gte("created_at", filter.since.toISOString());

  const { count, error } = await query;
  if (error) throw new Error(`Could not count AI audits: ${error.message}`);
  return count ?? 0;
}

/** Checked before an upload starts a new audit. Approximate under races, which is fine for cost. */
export async function checkAiQuota(dealId: string): Promise<AiQuotaResult> {
  const [forDeal, lastHour] = await Promise.all([
    countAudits({ dealId }),
    countAudits({ since: new Date(Date.now() - 60 * 60 * 1000) }),
  ]);

  if (forDeal >= AI_AUDITS_PER_DEAL) return { ok: false, reason: "DEAL_LIMIT" };
  if (lastHour >= AI_AUDITS_PER_HOUR) return { ok: false, reason: "HOURLY_LIMIT" };
  return { ok: true };
}

export const AI_QUOTA_MESSAGES: Record<"DEAL_LIMIT" | "HOURLY_LIMIT", string> = {
  DEAL_LIMIT: "This deal reached its limit of AI checks in the demo. Create a new deal to try again.",
  HOURLY_LIMIT: "The demo is busy right now. Try again in a few minutes.",
};
