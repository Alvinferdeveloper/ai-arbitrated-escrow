import { resolveCarrier } from "@/lib/paypal/tracking";
import { ESCALATION_RULES } from "./rules.config";

// Deterministic fraud signals that need no model: the handwritten code, dates,
// tracking formats and photo metadata. The rules in rules.ts act on them.

/** No 0/O, 1/I/L, so a handwritten code reads back unambiguously. */
export const VERIFICATION_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function normalizeCode(value: string | null): string {
  return (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function codeMatches(read: string | null, expected: string): boolean {
  const target = normalizeCode(expected);
  return target.length > 0 && normalizeCode(read) === target;
}

function startOfUtcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** A guide printed before the deal existed belongs to another shipment. */
export function guidePredatesDeal(dateIso: string | null, dealCreatedAt: Date): boolean {
  if (!dateIso) return false;
  const guideDay = Date.parse(`${dateIso}T00:00:00Z`);
  if (Number.isNaN(guideDay)) return false;
  return guideDay < startOfUtcDay(dealCreatedAt) - ESCALATION_RULES.freshnessToleranceMs;
}

// Public formats of the carriers PayPal knows. Unlisted carriers are not checked.
const TRACKING_FORMATS: Record<string, RegExp> = {
  UPS: /^1Z[0-9A-Z]{16}$/,
  USPS: /^(\d{20,22}|[A-Z]{2}\d{9}US)$/,
  FEDEX: /^(\d{12}|\d{15}|\d{20}|\d{22})$/,
  DHL: /^(\d{10}|[A-Z]{3}\d{7})$/,
};

/** False for carriers with no public format, whose numbers are not checked. */
export function hasTrackingFormat(carrier: string | null): boolean {
  return Boolean(carrier && TRACKING_FORMATS[resolveCarrier(carrier).carrier]);
}

export function trackingFitsCarrier(carrier: string | null, trackingNumber: string | null): boolean {
  if (!carrier || !trackingNumber) return true;
  const format = TRACKING_FORMATS[resolveCarrier(carrier).carrier];
  return !format || format.test(trackingNumber.toUpperCase().replace(/[\s-]/g, ""));
}

export type PhotoExif = Record<string, string | number | boolean | null>;

const EDITING_SOFTWARE =
  /photoshop|lightroom|gimp|snapseed|picsart|canva|facetune|pixelmator|affinity|photopea|fotor|airbrush/i;

/** Only a positive trace counts; missing EXIF is normal for messaging apps. */
export function isEditedPhoto(exif: PhotoExif): boolean {
  return typeof exif.Software === "string" && EDITING_SOFTWARE.test(exif.Software);
}

export function isOldPhoto(exif: PhotoExif, dealCreatedAt: Date): boolean {
  if (typeof exif.DateTimeOriginal !== "string") return false;
  const taken = Date.parse(exif.DateTimeOriginal);
  if (Number.isNaN(taken)) return false;
  return taken < dealCreatedAt.getTime() - ESCALATION_RULES.freshnessToleranceMs;
}
