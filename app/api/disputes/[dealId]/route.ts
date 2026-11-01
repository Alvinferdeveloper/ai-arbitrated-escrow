import { after } from "next/server";
import { runStoredArbitration } from "@/lib/agents/arbitration-runner";
import { DisputeUnavailableError, SupabaseDisputeStore } from "@/lib/db/dispute-store";
import {
  getDealState,
  removeEvidencePhotos,
  uploadEvidencePhoto,
} from "@/lib/db/evidence-store";
import { isSupabaseConfigured } from "@/lib/db/server";
import { isEvidenceFileError, readEvidenceFile } from "@/lib/deals/evidence-file";
import {
  disputeReasonSchema,
  unboxingUploadMetadataSchema,
} from "@/lib/deals/evidence-upload";
import { dealIdSchema } from "@/lib/deals/schema";
import { openDispute, submitUnboxingEvidence } from "@/lib/state-machine/dispute";
import {
  DealNotFoundError,
  TransitionConflictError,
} from "@/lib/state-machine/transition";

// From SHIPPED this opens the dispute and submits photo D; from DISPUTED
// (a retry, or a mediator asking for more) it only submits the photo.

export const maxDuration = 120;

const UNAVAILABLE: Record<string, string> = {
  dispute_window_closed: "The dispute window closed when the auto-release deadline passed.",
  settlement_already_queued: "The payout was already sent after the receipt was confirmed.",
  no_open_dispute: "There is no open dispute on this deal.",
  invalid_reason: "Say what is wrong with the parcel.",
};

function fail(status: number, error: string, message: string): Response {
  return Response.json({ ok: false, error, message }, { status });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ dealId: string }> },
) {
  const parsedDeal = dealIdSchema.safeParse((await context.params).dealId);
  if (!parsedDeal.success) return fail(400, "invalid_deal", "The deal link is not valid.");
  const dealId = parsedDeal.data;

  if (!isSupabaseConfigured()) {
    return fail(503, "not_configured", "Disputes need Supabase in this environment.");
  }

  let form: FormData;
  let metadataJson: unknown;
  try {
    form = await request.formData();
    metadataJson = JSON.parse(String(form.get("metadata") ?? ""));
  } catch {
    return fail(400, "invalid_form", "The dispute could not be read. Try again.");
  }

  const metadata = unboxingUploadMetadataSchema.safeParse(metadataJson);
  if (!metadata.success) {
    return fail(400, "invalid_metadata", "The photo details are not valid. Try again.");
  }

  const state = await getDealState(dealId);
  if (!state) return fail(404, "deal_not_found", "This deal no longer exists.");
  if (state !== "SHIPPED" && state !== "DISPUTED") {
    return fail(409, "not_open_to_dispute", "This deal cannot be disputed right now.");
  }

  const reason = disputeReasonSchema.safeParse(form.get("reason") ?? "");
  if (state === "SHIPPED" && !reason.success) {
    return fail(400, "invalid_reason", reason.error.issues[0]?.message ?? UNAVAILABLE.invalid_reason);
  }

  const file = await readEvidenceFile(form, dealId, "D", metadata.data.D);
  if (isEvidenceFileError(file)) return fail(file.status, file.error, file.message);

  const store = new SupabaseDisputeStore();
  let stored = false;

  try {
    await uploadEvidencePhoto(file.item.storagePath, file.bytes, file.item.mediaType);
    stored = true;

    if (state === "SHIPPED" && reason.success) {
      await openDispute({ dealId, reason: reason.data }, store);
    }

    const { auditId } = await submitUnboxingEvidence({ dealId, item: file.item }, store);

    after(async () => {
      try {
        await runStoredArbitration(auditId);
      } catch (error) {
        // The retry-audits cron picks it up.
        console.error("Arbitration failed to run", auditId, error);
      }
    });

    return Response.json({ ok: true, auditId }, { status: 202 });
  } catch (error) {
    if (stored) await removeEvidencePhotos([file.item.storagePath]);

    if (error instanceof DisputeUnavailableError) {
      return fail(409, error.code, UNAVAILABLE[error.code] ?? "This deal cannot be disputed.");
    }
    if (error instanceof DealNotFoundError) {
      return fail(404, "deal_not_found", "This deal no longer exists.");
    }
    if (error instanceof TransitionConflictError) {
      return fail(409, "not_open_to_dispute", "The deal changed. Reload the page.");
    }

    console.error("Dispute submission failed", dealId, error);
    return fail(500, "dispute_failed", "The dispute could not be saved. Nothing changed; try again.");
  }
}
