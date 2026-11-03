import { extractListing } from "@/lib/agents/listing";
import { createVisionModel } from "@/lib/agents/model";
import { isModelConfigured } from "@/lib/agents/provider";
import { EVIDENCE_MAX_BYTES } from "@/lib/config";
import { sniffImageType } from "@/lib/deals/evidence-upload";
import { allowRequest, clientKey } from "@/lib/http/rate-limit";

// Reads a listing screenshot into create-deal form values. Nothing is stored.

export const maxDuration = 60;

const EXTRACTIONS_PER_MINUTE = 5;

function fail(status: number, error: string, message: string): Response {
  return Response.json({ ok: false, error, message }, { status });
}

export async function POST(request: Request) {
  if (!isModelConfigured()) {
    return fail(503, "not_configured", "Reading screenshots needs the AI model in this environment.");
  }

  if (!allowRequest(`extract:${clientKey(request)}`, EXTRACTIONS_PER_MINUTE, 60_000)) {
    return fail(429, "rate_limited", "Too many screenshots in a minute. Wait a moment and try again.");
  }

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("screenshot");
  } catch {
    return fail(400, "invalid_form", "The screenshot could not be read. Try again.");
  }

  if (!(file instanceof File) || file.size === 0) {
    return fail(400, "missing_screenshot", "Choose a screenshot of the listing.");
  }
  if (file.size > EVIDENCE_MAX_BYTES) {
    return fail(413, "too_large", "The screenshot is larger than 10 MB.");
  }

  const data = new Uint8Array(await file.arrayBuffer());
  const mediaType = sniffImageType(data);
  if (!mediaType) {
    return fail(415, "unsupported_image", "Use a JPEG, PNG or WebP screenshot.");
  }

  const result = await extractListing({ model: createVisionModel(), image: { mediaType, data } });

  if (!result.ok) {
    return result.reason === "NOT_A_LISTING"
      ? fail(422, "not_a_listing", "That image does not look like a listing. Fill the form by hand.")
      : fail(502, "extraction_failed", "The AI could not read the screenshot. Fill the form by hand.");
  }

  return Response.json({ ok: true, draft: result.draft });
}
