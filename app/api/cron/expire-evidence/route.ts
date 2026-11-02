import { EVIDENCE_DEADLINE_MS } from "@/lib/config";
import { SupabaseAiRefundStore, listOverdueEvidenceDeals } from "@/lib/db/ai-refund-store";
import { isSupabaseConfigured } from "@/lib/db/server";
import { runAiRefund } from "@/lib/paypal/settlement-runner";
import { startAiRefund } from "@/lib/state-machine/ai-refund";
import { TransitionConflictError } from "@/lib/state-machine/transition";

// Refunds the buyer when the seller missed the evidence deadline.

export const maxDuration = 60;

const BATCH_SIZE = 5;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();

  if (!secret) {
    return Response.json({ ok: false, error: "cron_not_configured" }, { status: 503 });
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return Response.json({ ok: false, error: "supabase_not_configured" }, { status: 503 });
  }

  const overdue = await listOverdueEvidenceDeals(
    new Date(Date.now() - EVIDENCE_DEADLINE_MS),
    BATCH_SIZE,
  );
  const results: { dealId: string; outcome: string }[] = [];

  for (const deal of overdue) {
    try {
      await startAiRefund(
        { dealId: deal.id, from: deal.state, actor: "system", reason: "EVIDENCE_TIMEOUT" },
        new SupabaseAiRefundStore(),
      );
      const settlement = await runAiRefund(deal.id);
      results.push({ dealId: deal.id, outcome: settlement.outcome });
    } catch (error) {
      if (error instanceof TransitionConflictError) {
        results.push({ dealId: deal.id, outcome: "MOVED_ON" });
        continue;
      }
      console.error("Evidence deadline refund failed", deal.id, error);
      results.push({ dealId: deal.id, outcome: "FAILED" });
    }
  }

  const failed = results.filter((result) => result.outcome === "FAILED").length;
  return Response.json({ ok: failed === 0, due: overdue.length, failed, results });
}
