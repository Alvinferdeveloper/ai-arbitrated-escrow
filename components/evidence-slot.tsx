import { CircleCheck, Clock } from "lucide-react";
import type { EvidenceView } from "@/lib/deals/types";

export function EvidenceSlot({ evidence }: { evidence: EvidenceView }) {
  const uploaded = evidence.status === "uploaded";

  return (
    <figure className="overflow-hidden rounded-lg border border-rule-line bg-sheet">
      {evidence.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
        <img
          src={evidence.imageUrl}
          alt={`Photo ${evidence.slot}: ${evidence.title}`}
          className="aspect-[4/3] w-full bg-kraft object-cover"
        />
      ) : (
        <div
          className={`relative flex flex-col items-center justify-center gap-2 bg-kraft p-6 text-center ${
            uploaded ? "h-28" : "aspect-[4/3]"
          }`}
        >
          <span
            aria-hidden="true"
            className="font-mono text-[2rem] leading-none text-ink-muted"
          >
            {evidence.slot}
          </span>
          <span className="text-[0.8125rem] font-medium text-ink-muted">
            {uploaded ? "Demo photo" : "No photo yet"}
          </span>
        </div>
      )}
      <figcaption className="border-t border-rule-line p-4">
        <p className="text-[0.875rem] font-medium text-ink">
          Photo {evidence.slot}: {evidence.title}
        </p>
        <p className="mt-1 text-[0.875rem] leading-[1.55] text-ink-muted">
          {evidence.description}
        </p>
        <p
          className={`mt-3 inline-flex items-center gap-1.5 text-[0.8125rem] font-medium ${
            uploaded ? "text-cleared" : "text-ink-muted"
          }`}
        >
          {uploaded ? (
            <CircleCheck aria-hidden="true" size={16} strokeWidth={1.75} />
          ) : (
            <Clock aria-hidden="true" size={16} strokeWidth={1.75} />
          )}
          {uploaded ? "Photo ready" : "Waiting for the photo"}
        </p>
      </figcaption>
    </figure>
  );
}
