import { z } from "zod";

// The model's only allowed output. Strict objects reject extra keys so a
// prompt injection cannot smuggle fields that later code might trust.

const reasonSchema = z.string().trim().min(1).max(500);
const guideFieldSchema = z.string().trim().min(1).max(80).nullable();
const handwrittenCodeSchema = z.string().trim().min(1).max(20).nullable();

export const evidenceAuditSchema = z
  .strictObject({
  product: z.strictObject({
    /** Photo A: is the item the same product, model and condition as the listing? */
    matchesListing: z.boolean(),
    /** Photo A shows another kind of product altogether, not a variant of the listed one. */
    differentItem: z.boolean(),
    /** A serial number or model label on the product is legible in photo A. */
    identifierVisible: z.boolean(),
    /** Typical shipping weight of the listed product with packaging, in kg. */
    expectedWeightKg: z.number().positive().finite().max(100),
    reason: reasonSchema,
  }),
  packing: z.strictObject({
    /** Photo B: is the product visible inside the packing? */
    productInside: z.boolean(),
    reason: reasonSchema,
  }),
  parcel: z.strictObject({
    /** Photo C: is the parcel closed and sealed? */
    sealed: z.boolean(),
    /** Photo C: is the shipping guide visible in the frame? */
    guideVisible: z.boolean(),
    reason: reasonSchema,
  }),
  guide: z.strictObject({
    /** False when the guide is unreadable or any required field is missing. */
    readable: z.boolean(),
    carrier: guideFieldSchema,
    trackingNumber: guideFieldSchema,
    /** Weight printed on the guide, in kg. */
    weightKg: z.number().positive().finite().max(100).nullable(),
    date: guideFieldSchema,
    /** The guide date as YYYY-MM-DD, or null when day and month order is ambiguous. */
    dateIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  }),
  /** Handwritten codes transcribed as seen. The model is never told the expected code. */
  verification: z.strictObject({
    codeInPhotoA: handwrittenCodeSchema,
    codeInPhotoC: handwrittenCodeSchema,
  }),
  /** Material contradictions only. Cosmetic notes do not belong here. */
  inconsistencies: z.array(reasonSchema).max(10),
  })
  .refine((audit) => !(audit.product.differentItem && audit.product.matchesListing), {
    path: ["product", "differentItem"],
    message: "A different item cannot match the listing",
  });

export type EvidenceAudit = z.infer<typeof evidenceAuditSchema>;

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

/** Audits stored before newer findings existed read them as false or null. */
export const storedEvidenceAuditSchema = z.preprocess((value) => {
  const audit = asObject(value);
  const product = asObject(audit?.product);
  if (!audit || !product) return value;
  const guide = asObject(audit.guide);
  return {
    verification: { codeInPhotoA: null, codeInPhotoC: null },
    ...audit,
    product: { differentItem: false, identifierVisible: false, ...product },
    ...(guide ? { guide: { dateIso: null, ...guide } } : {}),
  };
}, evidenceAuditSchema);

export const BUYER_ITEM_CONDITIONS = [
  "AS_DESCRIBED",
  "DAMAGED",
  "DIFFERENT_ITEM",
  "EMPTY_PARCEL",
  "UNKNOWN",
] as const;

export const ARBITRATION_CLAIMS = [
  "SUPPORTED",
  "NOT_SUPPORTED",
  "UNCLEAR",
] as const;

/**
 * What the buyer's unboxing evidence shows. The model compares it with the
 * seller's audit and photos; the rules decide release, refund or escalation.
 */
export const buyerEvidenceSchema = z
  .strictObject({
    item: z.strictObject({
      /** Same product, model and condition as the listing. */
      matchesListing: z.boolean(),
      /** Same item as the seller's product photo, ignoring lighting. */
      matchesSellerPhoto: z.boolean(),
      condition: z.enum(BUYER_ITEM_CONDITIONS),
      reason: reasonSchema,
    }),
    parcel: z.strictObject({
      sealedOnArrival: z.boolean(),
      /** Box, tape and label match the seller's parcel photo. */
      matchesSellerParcel: z.boolean(),
      reason: reasonSchema,
    }),
    /** Optional: only when the buyer put the parcel on a scale. */
    recordedWeightKg: z.number().positive().finite().max(100).nullable(),
    claim: z.strictObject({
      supported: z.enum(ARBITRATION_CLAIMS),
      reason: reasonSchema,
    }),
    inconsistencies: z.array(reasonSchema).max(10),
  })
  .superRefine((audit, ctx) => {
    if (audit.item.matchesListing && audit.item.condition !== "AS_DESCRIBED") {
      ctx.addIssue({
        code: "custom",
        path: ["item", "condition"],
        message: "A matching item must be reported as AS_DESCRIBED",
      });
    }

    if (!audit.item.matchesListing && audit.item.condition === "AS_DESCRIBED") {
      ctx.addIssue({
        code: "custom",
        path: ["item", "condition"],
        message: "A non-matching item cannot be reported as AS_DESCRIBED",
      });
    }
  });

export type BuyerEvidenceAudit = z.infer<typeof buyerEvidenceSchema>;

/** What the model reads from a screenshot of a listing. Null when not visible. */
export const listingExtractionSchema = z.strictObject({
  /** False when the image is not a product listing at all. */
  isListing: z.boolean(),
  title: z.string().trim().min(1).max(140).nullable(),
  description: z.string().trim().min(1).max(2000).nullable(),
  price: z.number().positive().finite().max(10_000_000).nullable(),
  /** ISO 4217 code such as USD or EUR, only when the screenshot shows it. */
  currency: z.string().trim().regex(/^[A-Z]{3}$/).nullable(),
});

export type ListingExtraction = z.infer<typeof listingExtractionSchema>;
