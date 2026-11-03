"use client";

import { AlertCircle, ScanText, Sparkles } from "lucide-react";
import { useId, useState } from "react";
import type { ListingDraft } from "@/lib/agents/listing";
import { preparePhoto } from "@/lib/deals/prepare-photo";

type ImportState =
  | { status: "idle" }
  | { status: "reading" }
  | { status: "done"; note: string | null }
  | { status: "error"; message: string };

type ExtractResponse = { ok: true; draft: ListingDraft } | { ok: false; message?: string };

export function ScreenshotImport({ onDraft }: { onDraft: (draft: ListingDraft) => void }) {
  const inputId = useId();
  const [state, setState] = useState<ImportState>({ status: "idle" });
  const reading = state.status === "reading";

  async function read(file: File | undefined) {
    if (!file) return;
    setState({ status: "reading" });

    try {
      const { blob } = await preparePhoto(file);
      const body = new FormData();
      body.append("screenshot", blob, "listing.jpg");

      const response = await fetch("/api/deals/extract", { method: "POST", body });
      const result = (await response.json()) as ExtractResponse;

      if (!result.ok) {
        setState({
          status: "error",
          message: result.message ?? "The AI could not read the screenshot. Fill the form by hand.",
        });
        return;
      }

      onDraft(result.draft);
      setState({ status: "done", note: result.draft.note });
    } catch {
      setState({ status: "error", message: "The screenshot could not be sent. Fill the form by hand." });
    }
  }

  return (
    <section
      aria-labelledby="import-heading"
      className="space-y-3 rounded-lg border border-rule-line bg-sheet p-4"
    >
      <div className="flex items-start gap-3">
        <ScanText aria-hidden="true" size={20} strokeWidth={1.75} className="mt-0.5 shrink-0 text-postal-ink" />
        <div>
          <h2 id="import-heading" className="text-[0.9375rem] font-semibold leading-[1.35] text-ink">
            Start from a screenshot of your listing
          </h2>
          <p className="mt-1 max-w-[65ch] text-[0.875rem] leading-[1.55] text-ink-muted">
            The AI reads the title, price and description and fills the form. Check
            every field before you create the deal; the screenshot is not stored.
          </p>
        </div>
      </div>

      <label
        htmlFor={inputId}
        className={`inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-rule-line bg-sheet px-4 text-[0.875rem] font-medium text-ink transition-colors duration-150 ease-out-quart hover:bg-kraft has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-postal-ink has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-paper ${
          reading ? "pointer-events-none opacity-60" : ""
        }`}
      >
        {reading ? "Reading the listing" : "Choose a screenshot"}
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={reading}
          className="sr-only"
          onChange={(event) => {
            void read(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </label>

      {state.status === "done" ? (
        <p role="status" className="flex items-start gap-2 text-[0.875rem] leading-[1.55] text-ink">
          <Sparkles aria-hidden="true" size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-postal-ink" />
          {state.note ?? "Filled from your screenshot. Check the fields below."}
        </p>
      ) : null}
      {state.status === "error" ? (
        <p role="alert" className="flex items-start gap-2 text-[0.875rem] leading-[1.55] text-blocked">
          <AlertCircle aria-hidden="true" size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
          {state.message}
        </p>
      ) : null}
    </section>
  );
}
