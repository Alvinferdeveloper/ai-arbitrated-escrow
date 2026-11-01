import {
  runStoredEvidenceAudit,
  settleFinishedAudit,
} from "@/lib/agents/evidence-audit-runner";
import {
  listFinishedAuditsAwaitingDecision,
  listStuckAudits,
} from "@/lib/db/evidence-store";
import { isSupabaseConfigured } from "@/lib/db/server";

// Reruns audits whose background run died and applies decisions that never landed.

export const maxDuration = 120;

const BATCH_SIZE = 3;

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

  const results: { auditId: string; outcome: string }[] = [];
  let failed = 0;

  for (const audit of await listStuckAudits(BATCH_SIZE)) {
    try {
      const result = await runStoredEvidenceAudit(audit.id);
      results.push({
        auditId: audit.id,
        outcome: result.status === "DONE" ? result.outcome : result.reason,
      });
    } catch (error) {
      failed += 1;
      console.error("Stuck audit retry failed", audit.id, error);
      results.push({ auditId: audit.id, outcome: "FAILED" });
    }
  }

  for (const audit of await listFinishedAuditsAwaitingDecision(BATCH_SIZE)) {
    try {
      const applied = await settleFinishedAudit(audit);
      results.push({ auditId: audit.id, outcome: applied ? "DECISION_APPLIED" : "SUPERSEDED" });
    } catch (error) {
      failed += 1;
      console.error("Applying a finished audit failed", audit.id, error);
      results.push({ auditId: audit.id, outcome: "FAILED" });
    }
  }

  return Response.json({ ok: failed === 0, failed, results });
}
