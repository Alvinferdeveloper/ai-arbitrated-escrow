import { listDueReleases, requestRelease } from "@/lib/db/release-store";
import { isSupabaseConfigured } from "@/lib/db/server";
import { listPendingTracking } from "@/lib/db/tracking-store";
import { runPendingSettlement } from "@/lib/paypal/settlement-runner";
import { registerShipmentTracking } from "@/lib/paypal/tracking-runner";

// FR7: releases shipped deals whose deadline passed. Wired to Vercel Cron with
// CRON_SECRET; each payout stays queued until PayPal's webhook confirms it.
// It also retries PayPal tracking registrations that failed when the deal shipped.

export const maxDuration = 60;

const BATCH_SIZE = 5;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();

  if (!secret) {
    return Response.json(
      { ok: false, error: "cron_not_configured" },
      { status: 503 },
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return Response.json(
      { ok: false, error: "supabase_not_configured" },
      { status: 503 },
    );
  }

  const due = await listDueReleases(BATCH_SIZE);
  const results: { dealId: string; outcome: string }[] = [];
  let failed = 0;

  for (const deal of due) {
    try {
      await requestRelease(deal.id);
      const result = await runPendingSettlement(deal.id);
      results.push({ dealId: deal.id, outcome: result.outcome });
    } catch (error) {
      failed += 1;
      console.error("Auto-release failed", deal.id, error);
      results.push({ dealId: deal.id, outcome: "FAILED" });
    }
  }

  const tracking: { dealId: string; outcome: string }[] = [];
  try {
    for (const dealId of await listPendingTracking(BATCH_SIZE)) {
      tracking.push({ dealId, outcome: await registerShipmentTracking(dealId) });
    }
  } catch (error) {
    console.error("Tracking retry failed", error);
  }

  return Response.json({
    ok: failed === 0,
    due: due.length,
    failed,
    results,
    tracking,
  });
}
