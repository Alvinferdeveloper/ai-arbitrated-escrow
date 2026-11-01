"use client";

import { AlertCircle, Camera, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { EvidencePhotoSlot } from "@/lib/agents/ports";
import { EVIDENCE_SLOT_COPY } from "@/lib/deals/evidence";
import { EVIDENCE_UPLOAD_SLOTS, photoFieldName } from "@/lib/deals/evidence-upload";
import { preparePhoto, type PreparedPhoto } from "@/lib/deals/prepare-photo";

type SlotState =
  | { status: "empty" }
  | { status: "preparing" }
  | { status: "ready"; photo: PreparedPhoto; previewUrl: string }
  | { status: "error"; message: string };

type SlotStates = Record<EvidencePhotoSlot, SlotState>;

const EMPTY: SlotStates = { A: { status: "empty" }, B: { status: "empty" }, C: { status: "empty" } };

function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function upload(
  url: string,
  body: FormData,
  onProgress: (fraction: number) => void,
): Promise<{ ok: boolean; message?: string }> {
  // XHR rather than fetch: fetch cannot report upload progress.
  return new Promise((resolve) => {
    const request = new XMLHttpRequest();
    request.open("POST", url);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onload = () => {
      try {
        resolve(JSON.parse(request.responseText) as { ok: boolean; message?: string });
      } catch {
        resolve({ ok: false, message: "The server answered with an error. Try again." });
      }
    };
    request.onerror = () =>
      resolve({ ok: false, message: "The upload was interrupted. Check the connection and try again." });
    request.send(body);
  });
}

export function EvidenceUploadForm({ dealId }: { dealId: string }) {
  const router = useRouter();
  const [slots, setSlots] = useState<SlotStates>(EMPTY);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const previewUrls = useRef<Partial<Record<EvidencePhotoSlot, string>>>({});

  useEffect(() => {
    const urls = previewUrls.current;
    return () => Object.values(urls).forEach((url) => url && URL.revokeObjectURL(url));
  }, []);

  function setPreview(slot: EvidencePhotoSlot, url: string | undefined) {
    const previous = previewUrls.current[slot];
    if (previous) URL.revokeObjectURL(previous);
    previewUrls.current[slot] = url;
  }

  async function choose(slot: EvidencePhotoSlot, file: File | undefined) {
    if (!file) return;
    setError(null);
    setPreview(slot, undefined);
    setSlots((current) => ({ ...current, [slot]: { status: "preparing" } }));

    try {
      const photo = await preparePhoto(file);
      const previewUrl = URL.createObjectURL(photo.blob);
      setPreview(slot, previewUrl);
      setSlots((current) => ({ ...current, [slot]: { status: "ready", photo, previewUrl } }));
    } catch {
      setSlots((current) => ({
        ...current,
        [slot]: {
          status: "error",
          message: "This photo could not be read. Use a JPEG, PNG or WebP image.",
        },
      }));
    }
  }

  const ready = EVIDENCE_UPLOAD_SLOTS.every((slot) => slots[slot].status === "ready");
  const uploading = progress !== null;

  async function submit() {
    if (!ready || uploading) return;

    const body = new FormData();
    const metadata: Record<string, Omit<PreparedPhoto, "blob">> = {};

    for (const slot of EVIDENCE_UPLOAD_SLOTS) {
      const state = slots[slot];
      if (state.status !== "ready") return;
      const { blob, ...details } = state.photo;
      body.append(photoFieldName(slot), blob, `${slot}.jpg`);
      metadata[slot] = details;
    }
    body.append("metadata", JSON.stringify(metadata));

    setError(null);
    setProgress(0);
    const result = await upload(`/api/evidence/${dealId}`, body, setProgress);
    setProgress(null);

    if (!result.ok) {
      setError(result.message ?? "The photos could not be saved. Try again.");
      return;
    }

    router.refresh();
  }

  return (
    <section aria-labelledby="upload-heading" className="space-y-5">
      <div>
        <h2 id="upload-heading" className="text-[1.125rem] font-semibold leading-[1.35] text-ink">
          Upload the evidence
        </h2>
        <p className="mt-1 max-w-[65ch] text-[0.9375rem] leading-[1.55] text-ink-muted">
          Three photos. They are resized on this device before upload, and the audit
          starts as soon as all three are in.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {EVIDENCE_UPLOAD_SLOTS.map((slot) => (
          <UploadSlot
            key={slot}
            slot={slot}
            state={slots[slot]}
            disabled={uploading}
            onChoose={(file) => choose(slot, file)}
          />
        ))}
      </div>

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-blocked bg-blocked-wash p-3 text-blocked"
        >
          <AlertCircle aria-hidden="true" size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
          <p className="text-[0.875rem] leading-[1.55]">{error}</p>
        </div>
      ) : null}

      {uploading ? (
        <div role="status" aria-live="polite" className="space-y-2">
          <p className="text-[0.875rem] text-ink">Uploading photos A, B and C</p>
          <div className="h-1.5 overflow-hidden rounded-full bg-kraft">
            <div
              className="h-full bg-postal-ink transition-[width] duration-150 ease-out-quart"
              style={{ width: `${Math.round((progress ?? 0) * 100)}%` }}
            />
          </div>
        </div>
      ) : null}

      <div className="border-t border-rule-line pt-5">
        <Button type="button" disabled={!ready || uploading} onClick={submit} className="w-full sm:w-auto">
          {uploading ? "Uploading" : "Send for audit"}
        </Button>
        <p className="mt-3 max-w-[65ch] text-[0.8125rem] leading-[1.5] text-ink-muted">
          The money stays held. Shipping opens only if the audit passes.
        </p>
      </div>
    </section>
  );
}

function UploadSlot({
  slot,
  state,
  disabled,
  onChoose,
}: {
  slot: EvidencePhotoSlot;
  state: SlotState;
  disabled: boolean;
  onChoose: (file: File | undefined) => void;
}) {
  const inputId = useId();
  const copy = EVIDENCE_SLOT_COPY[slot];
  const ready = state.status === "ready";

  return (
    <figure className="overflow-hidden rounded-lg border border-rule-line bg-sheet">
      <div className="relative flex aspect-[4/3] items-center justify-center bg-kraft">
        {ready ? (
          // eslint-disable-next-line @next/next/no-img-element -- local blob preview
          <img
            src={state.previewUrl}
            alt={`Photo ${slot}: ${copy.title}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <span aria-hidden="true" className="font-mono text-[2rem] leading-none text-ink-muted">
            {slot}
          </span>
        )}
        {state.status === "preparing" ? (
          <span className="absolute inset-x-0 bottom-0 bg-sheet/90 py-1.5 text-center text-[0.8125rem] text-ink-muted">
            Resizing
          </span>
        ) : null}
      </div>
      <figcaption className="space-y-3 border-t border-rule-line p-4">
        <div>
          <p className="text-[0.875rem] font-medium text-ink">
            Photo {slot}: {copy.title}
          </p>
          <p className="mt-1 text-[0.875rem] leading-[1.55] text-ink-muted">{copy.description}</p>
        </div>

        {ready ? (
          <p className="font-mono text-[0.8125rem] tabular-nums text-ink-muted">
            {state.photo.width} x {state.photo.height} px, {formatBytes(state.photo.blob.size)}
          </p>
        ) : null}
        {state.status === "error" ? (
          <p role="alert" className="text-[0.8125rem] leading-[1.5] text-blocked">
            {state.message}
          </p>
        ) : null}

        <label
          htmlFor={inputId}
          className={`inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-rule-line bg-sheet px-4 text-[0.875rem] font-medium text-ink transition-colors duration-150 ease-out-quart hover:bg-kraft has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-postal-ink has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-paper ${
            disabled ? "pointer-events-none opacity-60" : ""
          }`}
        >
          {ready ? (
            <RefreshCw aria-hidden="true" size={16} strokeWidth={1.75} />
          ) : (
            <Camera aria-hidden="true" size={16} strokeWidth={1.75} />
          )}
          {ready ? "Replace" : "Take or choose a photo"}
          <input
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            disabled={disabled}
            className="sr-only"
            onChange={(event) => {
              onChoose(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
      </figcaption>
    </figure>
  );
}
