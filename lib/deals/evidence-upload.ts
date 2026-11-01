import { z } from "zod";
import { EVIDENCE_PHOTO_SLOTS } from "@/lib/agents/ports";
import type { EvidenceSlot } from "./types";

export type EvidenceMediaType = "image/jpeg" | "image/png" | "image/webp";

export const EXIF_MAX_KEYS = 30;

const exifValueSchema = z.union([
  z.string().max(200),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

/** Flat EXIF summary. GPS coordinates are never sent, only whether they existed. */
export const exifSummarySchema = z
  .record(z.string().min(1).max(40), exifValueSchema)
  .refine((exif) => Object.keys(exif).length <= EXIF_MAX_KEYS, {
    message: `Keep the EXIF summary under ${EXIF_MAX_KEYS} fields`,
  });

export const photoMetadataSchema = z.strictObject({
  width: z.number().int().min(1).max(10_000),
  height: z.number().int().min(1).max(10_000),
  exif: exifSummarySchema,
});

export const evidenceUploadMetadataSchema = z.strictObject({
  A: photoMetadataSchema,
  B: photoMetadataSchema,
  C: photoMetadataSchema,
});

export type EvidenceUploadMetadata = z.infer<typeof evidenceUploadMetadataSchema>;
export type PhotoMetadata = z.infer<typeof photoMetadataSchema>;

export const unboxingUploadMetadataSchema = z.strictObject({ D: photoMetadataSchema });

export const disputeReasonSchema = z
  .string()
  .trim()
  .min(1, "Say what is wrong with the parcel")
  .max(2000, "Keep the reason under 2000 characters");

export function photoFieldName(slot: EvidenceSlot): string {
  return `photo${slot}`;
}

export const EVIDENCE_UPLOAD_SLOTS = EVIDENCE_PHOTO_SLOTS;

/** The declared content type is never trusted. */
export function sniffImageType(bytes: Uint8Array): EvidenceMediaType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  const ascii = (start: number, end: number) =>
    String.fromCharCode(...bytes.subarray(start, end));

  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") {
    return "image/webp";
  }

  return null;
}

export function extensionFor(mediaType: EvidenceMediaType): string {
  if (mediaType === "image/png") return "png";
  if (mediaType === "image/webp") return "webp";
  return "jpg";
}
