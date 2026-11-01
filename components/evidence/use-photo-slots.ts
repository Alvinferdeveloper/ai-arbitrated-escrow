"use client";

import { useEffect, useRef, useState } from "react";
import { photoFieldName } from "@/lib/deals/evidence-upload";
import { preparePhoto, type PreparedPhoto } from "@/lib/deals/prepare-photo";
import type { EvidenceSlot } from "@/lib/deals/types";

export type PhotoSlotState =
  | { status: "empty" }
  | { status: "preparing" }
  | { status: "ready"; photo: PreparedPhoto; previewUrl: string }
  | { status: "error"; message: string };

/** Resized photos plus their previews, keyed by evidence slot. */
export function usePhotoSlots<Slot extends EvidenceSlot>(slots: readonly Slot[]) {
  const [states, setStates] = useState<Record<Slot, PhotoSlotState>>(
    () => Object.fromEntries(slots.map((slot) => [slot, { status: "empty" }])) as Record<Slot, PhotoSlotState>,
  );
  const previewUrls = useRef<Partial<Record<Slot, string>>>({});

  useEffect(() => {
    const urls = previewUrls.current;
    return () => Object.values<string | undefined>(urls).forEach((url) => url && URL.revokeObjectURL(url));
  }, []);

  function setPreview(slot: Slot, url: string | undefined) {
    const previous = previewUrls.current[slot];
    if (previous) URL.revokeObjectURL(previous);
    previewUrls.current[slot] = url;
  }

  function setSlot(slot: Slot, state: PhotoSlotState) {
    setStates((current) => ({ ...current, [slot]: state }));
  }

  async function choose(slot: Slot, file: File | undefined) {
    if (!file) return;
    setPreview(slot, undefined);
    setSlot(slot, { status: "preparing" });

    try {
      const photo = await preparePhoto(file);
      const previewUrl = URL.createObjectURL(photo.blob);
      setPreview(slot, previewUrl);
      setSlot(slot, { status: "ready", photo, previewUrl });
    } catch {
      setSlot(slot, {
        status: "error",
        message: "This photo could not be read. Use a JPEG, PNG or WebP image.",
      });
    }
  }

  const ready = slots.every((slot) => states[slot].status === "ready");

  /** Appends every photo and a `metadata` field. */
  function toFormData(body = new FormData()): FormData {
    const metadata: Partial<Record<Slot, Omit<PreparedPhoto, "blob">>> = {};
    for (const slot of slots) {
      const state = states[slot];
      if (state.status !== "ready") throw new Error(`Photo ${slot} is not ready`);
      const { blob, ...details } = state.photo;
      body.append(photoFieldName(slot), blob, `${slot}.jpg`);
      metadata[slot] = details;
    }
    body.append("metadata", JSON.stringify(metadata));
    return body;
  }

  return { states, choose, ready, toFormData };
}
