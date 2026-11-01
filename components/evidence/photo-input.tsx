"use client";

import { Camera, RefreshCw } from "lucide-react";
import { useId } from "react";
import { EVIDENCE_SLOT_COPY } from "@/lib/deals/evidence";
import type { EvidenceSlot } from "@/lib/deals/types";
import type { PhotoSlotState } from "./use-photo-slots";

function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PhotoInput({
  slot,
  state,
  disabled,
  onChoose,
}: {
  slot: EvidenceSlot;
  state: PhotoSlotState;
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

export function UploadProgress({ label, progress }: { label: string; progress: number }) {
  return (
    <div role="status" aria-live="polite" className="space-y-2">
      <p className="text-[0.875rem] text-ink">{label}</p>
      <div className="h-1.5 overflow-hidden rounded-full bg-kraft">
        <div
          className="h-full bg-postal-ink transition-[width] duration-150 ease-out-quart"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
    </div>
  );
}
