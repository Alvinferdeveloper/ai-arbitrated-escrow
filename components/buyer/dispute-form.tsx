"use client";

import { AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PhotoInput, UploadProgress } from "@/components/evidence/photo-input";
import { uploadWithProgress } from "@/components/evidence/upload-with-progress";
import { SampleEvidencePicker } from "@/components/evidence/sample-evidence-picker";
import { usePhotoSlots } from "@/components/evidence/use-photo-slots";
import { UNBOXING_SCENARIOS } from "@/demo/sample-evidence";
import { Button } from "@/components/ui/button";

const SLOTS = ["D"] as const;

/**
 * `askReason` is false when the dispute is already open and only a new
 * unboxing photo is needed.
 */
export function DisputeForm({ dealId, askReason }: { dealId: string; askReason: boolean }) {
  const router = useRouter();
  const photos = usePhotoSlots(SLOTS);
  const [reason, setReason] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uploading = progress !== null;
  const canSubmit = photos.ready && (!askReason || reason.trim().length > 0) && !uploading;

  async function submit() {
    if (!canSubmit) return;

    const body = new FormData();
    if (askReason) body.append("reason", reason.trim());

    setError(null);
    setProgress(0);
    const result = await uploadWithProgress(
      `/api/disputes/${dealId}`,
      photos.toFormData(body),
      setProgress,
    );
    setProgress(null);

    if (!result.ok) {
      setError(result.message ?? "The dispute could not be sent. Try again.");
      return;
    }

    router.refresh();
  }

  return (
    <div className="space-y-5">
      {askReason ? (
        <div className="space-y-2">
          <label htmlFor="dispute-reason" className="block text-[0.8125rem] font-medium text-ink-muted">
            What is wrong with the parcel?
          </label>
          <textarea
            id="dispute-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={2000}
            rows={3}
            disabled={uploading}
            placeholder="The box arrived empty. The headphones were not inside."
            className="min-h-24 w-full rounded-md border border-rule-line bg-sheet px-3.5 py-3 text-[1rem] leading-[1.55] text-ink placeholder:text-ink-muted focus:border-postal-ink focus:outline-none focus:ring-2 focus:ring-postal-ink focus:ring-offset-2 focus:ring-offset-paper"
          />
        </div>
      ) : null}

      <SampleEvidencePicker
        scenarios={UNBOXING_SCENARIOS}
        slots={SLOTS}
        disabled={uploading}
        onLoad={photos.choose}
        onSelect={(scenario) => {
          if (askReason && scenario.reason) setReason(scenario.reason);
        }}
      />

      <div className="max-w-sm">
        <PhotoInput
          slot="D"
          state={photos.states.D}
          disabled={uploading}
          onChoose={(file) => photos.choose("D", file)}
        />
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

      {uploading ? <UploadProgress label="Sending the unboxing photo" progress={progress} /> : null}

      <div>
        <Button
          type="button"
          variant={askReason ? "destructive" : "primary"}
          disabled={!canSubmit}
          onClick={submit}
          className="w-full sm:w-auto"
        >
          {uploading ? "Sending" : askReason ? "Open the dispute" : "Send the photo"}
        </Button>
        <p className="mt-3 max-w-[65ch] text-[0.8125rem] leading-[1.5] text-ink-muted">
          The money stays held. Your photo is compared with the seller&apos;s, and a
          person decides if they disagree.
        </p>
      </div>
    </div>
  );
}
