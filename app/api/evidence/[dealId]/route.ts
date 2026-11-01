import { createHash } from "node:crypto";
import { after } from "next/server";
import { runStoredEvidenceAudit } from "@/lib/agents/evidence-audit-runner";
import { EVIDENCE_MAX_BYTES } from "@/lib/config";
import {
  getDealState,
  removeEvidencePhotos,
  SupabaseEvidenceSubmissionStore,
  uploadEvidencePhoto,
} from "@/lib/db/evidence-store";
import { isSupabaseConfigured } from "@/lib/db/server";
import {
  EVIDENCE_UPLOAD_SLOTS,
  evidenceUploadMetadataSchema,
  extensionFor,
  photoFieldName,
  sniffImageType,
} from "@/lib/deals/evidence-upload";
import { dealIdSchema } from "@/lib/deals/schema";
import {
  IncompleteEvidenceError,
  submitSellerEvidence,
  type EvidenceItem,
} from "@/lib/state-machine/evidence-submission";
import {
  DealNotFoundError,
  TransitionConflictError,
} from "@/lib/state-machine/transition";

// Answers right after storing the photos; the audit runs in after().

export const maxDuration = 120;

function fail(status: number, error: string, message: string): Response {
  return Response.json({ ok: false, error, message }, { status });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ dealId: string }> },
) {
  const { dealId: rawDealId } = await context.params;
  const parsedDeal = dealIdSchema.safeParse(rawDealId);
  if (!parsedDeal.success) {
    return fail(400, "invalid_deal", "The deal link is not valid.");
  }
  const dealId = parsedDeal.data;

  if (!isSupabaseConfigured()) {
    return fail(503, "not_configured", "Evidence uploads need Supabase in this environment.");
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail(400, "invalid_form", "The upload could not be read. Try again.");
  }

  let metadataJson: unknown;
  try {
    metadataJson = JSON.parse(String(form.get("metadata") ?? ""));
  } catch {
    return fail(400, "invalid_metadata", "The photo details are missing. Try again.");
  }

  const metadata = evidenceUploadMetadataSchema.safeParse(metadataJson);
  if (!metadata.success) {
    return fail(400, "invalid_metadata", "The photo details are not valid. Try again.");
  }

  // Checked again under a lock by the database.
  const state = await getDealState(dealId);
  if (!state) return fail(404, "deal_not_found", "This deal no longer exists.");
  if (state !== "FUNDS_HELD" && state !== "EVIDENCE_REJECTED") {
    return fail(409, "not_waiting_for_evidence", "This deal is not waiting for photos.");
  }

  const prepared: { item: EvidenceItem; bytes: Uint8Array }[] = [];

  for (const slot of EVIDENCE_UPLOAD_SLOTS) {
    const file = form.get(photoFieldName(slot));
    if (!(file instanceof File) || file.size === 0) {
      return fail(400, "missing_photo", `Photo ${slot} is missing.`);
    }
    if (file.size > EVIDENCE_MAX_BYTES) {
      return fail(413, "photo_too_large", `Photo ${slot} is larger than 10 MB.`);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const mediaType = sniffImageType(bytes);
    if (!mediaType) {
      return fail(415, "unsupported_photo", `Photo ${slot} must be a JPEG, PNG or WebP image.`);
    }

    prepared.push({
      bytes,
      item: {
        slot,
        mediaType,
        storagePath: `${dealId}/${slot}-${Date.now()}.${extensionFor(mediaType)}`,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        sizeBytes: bytes.byteLength,
        width: metadata.data[slot].width,
        height: metadata.data[slot].height,
        exif: metadata.data[slot].exif,
      },
    });
  }

  const stored: string[] = [];

  try {
    for (const { item, bytes } of prepared) {
      await uploadEvidencePhoto(item.storagePath, bytes, item.mediaType);
      stored.push(item.storagePath);
    }

    const { auditId } = await submitSellerEvidence(
      {
        dealId,
        from: state,
        items: prepared.map(({ item }) => item),
      },
      new SupabaseEvidenceSubmissionStore(),
    );

    after(async () => {
      try {
        await runStoredEvidenceAudit(auditId);
      } catch (error) {
        // The retry-audits cron picks it up.
        console.error("Evidence audit failed to run", auditId, error);
      }
    });

    return Response.json({ ok: true, auditId }, { status: 202 });
  } catch (error) {
    await removeEvidencePhotos(stored);

    if (error instanceof DealNotFoundError) {
      return fail(404, "deal_not_found", "This deal no longer exists.");
    }
    if (error instanceof TransitionConflictError) {
      return fail(409, "not_waiting_for_evidence", "The deal changed. Reload the page.");
    }
    if (error instanceof IncompleteEvidenceError) {
      return fail(400, "missing_photo", "Photos A, B and C are all required.");
    }

    console.error("Evidence upload failed", dealId, error);
    return fail(500, "upload_failed", "The photos could not be saved. Nothing changed; try again.");
  }
}
