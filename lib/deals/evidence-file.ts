import "server-only";
import { createHash } from "node:crypto";
import { EVIDENCE_MAX_BYTES } from "@/lib/config";
import type { EvidenceItem } from "@/lib/state-machine/evidence-submission";
import {
  extensionFor,
  photoFieldName,
  sniffImageType,
  type PhotoMetadata,
} from "./evidence-upload";
import type { EvidenceSlot } from "./types";

export type PreparedEvidenceFile = { item: EvidenceItem; bytes: Uint8Array };

export type EvidenceFileError = { status: number; error: string; message: string };

export async function readEvidenceFile(
  form: FormData,
  dealId: string,
  slot: EvidenceSlot,
  metadata: PhotoMetadata,
): Promise<PreparedEvidenceFile | EvidenceFileError> {
  const file = form.get(photoFieldName(slot));
  if (!(file instanceof File) || file.size === 0) {
    return { status: 400, error: "missing_photo", message: `Photo ${slot} is missing.` };
  }
  if (file.size > EVIDENCE_MAX_BYTES) {
    return { status: 413, error: "photo_too_large", message: `Photo ${slot} is larger than 10 MB.` };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mediaType = sniffImageType(bytes);
  if (!mediaType) {
    return {
      status: 415,
      error: "unsupported_photo",
      message: `Photo ${slot} must be a JPEG, PNG or WebP image.`,
    };
  }

  return {
    bytes,
    item: {
      slot,
      mediaType,
      storagePath: `${dealId}/${slot}-${Date.now()}.${extensionFor(mediaType)}`,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      sizeBytes: bytes.byteLength,
      width: metadata.width,
      height: metadata.height,
      exif: metadata.exif,
    },
  };
}

export function isEvidenceFileError(
  value: PreparedEvidenceFile | EvidenceFileError,
): value is EvidenceFileError {
  return "error" in value;
}
