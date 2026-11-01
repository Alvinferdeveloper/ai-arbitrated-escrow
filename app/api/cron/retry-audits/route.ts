import {
  runStoredArbitration,
  settleFinishedArbitration,
} from "@/lib/agents/arbitration-runner";
import {
  runStoredEvidenceAudit,
  settleFinishedAudit,
} from "@/lib/agents/evidence-audit-runner";
import { listFinishedArbitrationsAwaitingDecision } from "@/lib/db/dispute-store";
import {
  listFinishedAuditsAwaitingDecision,
  listStuckAudits,
} from "@/lib/db/evidence-store";
import { isSupabaseConfigured } from "@/lib/db/server";

// Reruns audits and arbitrations whose background run died, and applies
// decisions that never landed.

export const maxDuration = 120;

const BATCH_SIZE = 3;

type Result = { auditId: string; outcome: string };

async function attempt(auditId: string, work: () => Promise<string>): Promise<Result> {
  try {
    return { auditId, outcome: await work() };
  } catch (error) {
    console.error("Audit retry failed", auditId, error);
    return { auditId, outcome: "FAILED" };
  }
}

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

  const results: Result[] = [];

  for (const audit of await listStuckAudits(BATCH_SIZE)) {
    results.push(
      await attempt(audit.id, async () => {
        const result =
          audit.kind === "ARBITRATION"
            ? await runStoredArbitration(audit.id)
            : await runStoredEvidenceAudit(audit.id);
        return result.status === "DONE" ? result.outcome : result.reason;
      }),
    );
  }

  for (const audit of await listFinishedAuditsAwaitingDecision(BATCH_SIZE)) {
    results.push(
      await attempt(audit.id, async () =>
        (await settleFinishedAudit(audit)) ? "DECISION_APPLIED" : "SUPERSEDED",
      ),
    );
  }

  for (const arbitration of await listFinishedArbitrationsAwaitingDecision(BATCH_SIZE)) {
    results.push(
      await attempt(arbitration.id, async () =>
        (await settleFinishedArbitration(arbitration)) ? "DECISION_APPLIED" : "SUPERSEDED",
      ),
    );
  }

  const failed = results.filter((result) => result.outcome === "FAILED").length;
  return Response.json({ ok: failed === 0, failed, results });
}
