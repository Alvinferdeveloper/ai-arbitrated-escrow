"use client";

import { AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PhotoInput, UploadProgress } from "@/components/evidence/photo-input";
import { uploadWithProgress } from "@/components/evidence/upload-with-progress";
import { usePhotoSlots } from "@/components/evidence/use-photo-slots";
import { Button } from "@/components/ui/button";
import { EVIDENCE_UPLOAD_SLOTS } from "@/lib/deals/evidence-upload";
import { SampleEvidencePicker } from "@/components/evidence/sample-evidence-picker";
import { SAMPLE_SCENARIOS } from "@/demo/sample-evidence";

export function EvidenceUploadForm({ dealId, isSample }: { dealId: string; isSample: boolean }) {
  const router = useRouter();
  const photos = usePhotoSlots(EVIDENCE_UPLOAD_SLOTS);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uploading = progress !== null;

  async function submit() {
    if (!photos.ready || uploading) return;

    setError(null);
    setProgress(0);
    const result = await uploadWithProgress(
      `/api/evidence/${dealId}`,
      photos.toFormData(),
      setProgress,
    );
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

      <SampleEvidencePicker
        isSampleDeal={isSample}
        scenarios={SAMPLE_SCENARIOS}
        slots={EVIDENCE_UPLOAD_SLOTS}
        disabled={uploading}
        onLoad={photos.choose}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {EVIDENCE_UPLOAD_SLOTS.map((slot) => (
          <PhotoInput
            key={slot}
            slot={slot}
            state={photos.states[slot]}
            disabled={uploading}
            onChoose={(file) => photos.choose(slot, file)}
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

      {uploading ? <UploadProgress label="Uploading photos A, B and C" progress={progress} /> : null}

      <div className="border-t border-rule-line pt-5">
        <Button
          type="button"
          disabled={!photos.ready || uploading}
          onClick={submit}
          className="w-full sm:w-auto"
        >
          {uploading ? "Uploading" : "Send for audit"}
        </Button>
        <p className="mt-3 max-w-[65ch] text-[0.8125rem] leading-[1.5] text-ink-muted">
          The money stays held. Shipping opens only if the audit passes.
        </p>
      </div>
    </section>
  );
}
