// Types shared by the audit engine and the model adapter. Kept free of
// `server-only` so tests can import the rules without a browser guard.

import type { EvidenceAudit } from "./schemas";

export const EVIDENCE_PHOTO_SLOTS = ["A", "B", "C"] as const;
export type EvidencePhotoSlot = (typeof EVIDENCE_PHOTO_SLOTS)[number];

export type EvidenceImage = {
  slot: EvidencePhotoSlot;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  /** A short-lived signed URL or the image bytes. Never a public URL. */
  data: URL | Uint8Array;
};

export type EvidenceAuditInput = {
  title: string;
  description: string;
  priceCents: number;
};

export interface VisionModel {
  /**
   * Returns raw model output. The caller validates it with Zod; a model that
   * returns anything other than the audit shape is a technical failure.
   */
  auditEvidence(
    input: EvidenceAuditInput,
    images: readonly EvidenceImage[],
    signal: AbortSignal,
  ): Promise<unknown>;
}

export const ARBITRATION_IMAGE_ROLES = [
  "SELLER_PRODUCT",
  "SELLER_PARCEL",
  "BUYER_UNBOXING",
] as const;
export type ArbitrationImageRole = (typeof ARBITRATION_IMAGE_ROLES)[number];

export type ArbitrationImage = {
  role: ArbitrationImageRole;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  data: URL | Uint8Array;
};

export type ArbitrationInput = {
  title: string;
  description: string;
  priceCents: number;
  disputeReason: string;
  /** The pre-shipment audit, treated as the seller's claim. */
  sellerAudit: EvidenceAudit;
};

export interface ArbitrationModel {
  arbitrateDispute(
    input: ArbitrationInput,
    images: readonly ArbitrationImage[],
    signal: AbortSignal,
  ): Promise<unknown>;
}
