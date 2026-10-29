import {
  Clock,
  Gavel,
  MessageSquareWarning,
  PackageCheck,
  ScanSearch,
  type LucideIcon,
} from "lucide-react";
import { formatCaseTimestamp } from "@/lib/mediation/age";
import type {
  MediationTimelineActor,
  MediationTimelineEntry,
} from "@/lib/mediation/types";

const ACTOR_ICONS: Record<MediationTimelineActor, LucideIcon> = {
  buyer: MessageSquareWarning,
  seller: PackageCheck,
  ai: ScanSearch,
  system: Clock,
  mediator: Gavel,
};

const ACTOR_LABELS: Record<MediationTimelineActor, string> = {
  buyer: "Buyer",
  seller: "Seller",
  ai: "AI audit",
  system: "System",
  mediator: "Mediator",
};

export function CaseTimeline({ entries }: { entries: MediationTimelineEntry[] }) {
  return (
    <section aria-labelledby="timeline-heading">
      <h2
        id="timeline-heading"
        className="text-[1.125rem] font-semibold leading-[1.35] text-ink"
      >
        Case timeline
      </h2>
      <ol className="mt-4">
        {entries.map((entry, index) => {
          const Icon = ACTOR_ICONS[entry.actor];
          const isLast = index === entries.length - 1;

          return (
            <li key={entry.id} className="grid grid-cols-[2rem_1fr] gap-3">
              <div className="flex flex-col items-center">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-rule-line bg-kraft text-ink-muted">
                  <Icon aria-hidden="true" size={16} strokeWidth={1.75} />
                </span>
                {isLast ? null : <span className="w-px flex-1 bg-rule-line" />}
              </div>
              <div className={`min-w-0 ${isLast ? "pb-0" : "pb-6"}`}>
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <p className="text-[0.9375rem] font-medium text-ink">{entry.title}</p>
                  <span className="font-mono text-[0.75rem] tabular-nums text-ink-muted">
                    {formatCaseTimestamp(entry.at)}
                  </span>
                </div>
                <p className="mt-1 max-w-[65ch] text-[0.875rem] leading-[1.55] text-ink-muted">
                  {entry.detail}
                </p>
                <p className="mt-1 text-[0.75rem] font-medium uppercase tracking-[0.04em] text-ink-muted">
                  {ACTOR_LABELS[entry.actor]}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
