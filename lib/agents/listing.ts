import type { ListingImage, ListingModel } from "./ports";
import { ESCALATION_RULES } from "./rules.config";
import { listingExtractionSchema, type ListingExtraction } from "./schemas";
import { withTimeout } from "./timeout";

// Turns a listing screenshot into create-deal form values. Nothing is stored;
// the seller reviews every field before the deal exists.

export type ListingDraft = {
  title: string | null;
  description: string | null;
  /** Decimal USD for the price input, or null when the price is not in USD. */
  priceUsd: string | null;
  /** Shown to the seller when a field needs their attention. */
  note: string | null;
};

export type ExtractListingResult =
  | { ok: true; draft: ListingDraft }
  | { ok: false; reason: "NOT_A_LISTING" | "FAILED" };

const LISTING_TIMEOUT_MS = 30_000;

export function toListingDraft(extraction: ListingExtraction): ListingDraft {
  const { title, description, price, currency } = extraction;
  const isUsd = currency === null || currency === "USD";

  let note: string | null = null;
  if (price === null) note = "The price was not legible. Enter it in USD.";
  else if (!isUsd) note = `The listing price is in ${currency}. Enter the price in USD.`;

  return {
    title,
    description,
    priceUsd: price !== null && isUsd ? price.toFixed(2) : null,
    note,
  };
}

export async function extractListing({
  model,
  image,
  timeoutMs = LISTING_TIMEOUT_MS,
}: {
  model: ListingModel;
  image: ListingImage;
  timeoutMs?: number;
}): Promise<ExtractListingResult> {
  for (let attempt = 0; attempt <= ESCALATION_RULES.technicalRetries; attempt += 1) {
    try {
      const raw = await withTimeout((signal) => model.extractListing(image, signal), timeoutMs);
      const parsed = listingExtractionSchema.safeParse(raw);
      if (!parsed.success) continue;
      if (!parsed.data.isListing) return { ok: false, reason: "NOT_A_LISTING" };
      return { ok: true, draft: toListingDraft(parsed.data) };
    } catch {
      // Retried once, like every other model call.
    }
  }

  return { ok: false, reason: "FAILED" };
}
