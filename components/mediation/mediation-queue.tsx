"use client";

import { Flag, Inbox } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { StateStamp } from "@/components/state-stamp";
import { formatMoney } from "@/lib/deals/money";
import type { MediationQueueRow } from "@/lib/mediation/types";

const MediationGrid = dynamic(
  () => import("./mediation-grid").then((module) => module.MediationGrid),
  {
    ssr: false,
    loading: () => <QueueLoading />,
  },
);

export function MediationQueue({ rows }: { rows: MediationQueueRow[] }) {
  if (rows.length === 0) return <EmptyQueue />;

  return (
    <>
      <div className="hidden md:block">
        <MediationGrid rows={rows} />
      </div>
      <div className="md:hidden">
        <MobileQueueList rows={rows} />
      </div>
    </>
  );
}

function MobileQueueList({ rows }: { rows: MediationQueueRow[] }) {
  return (
    <ul className="divide-y divide-rule-line overflow-hidden rounded-lg border border-rule-line bg-sheet">
      {rows.map((row) => (
        <li key={row.id}>
          <Link
            href={`/mediator/${row.id}`}
            className="block p-4 transition-colors duration-150 ease-out-quart hover:bg-postal-ink-wash focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-postal-ink focus-visible:ring-inset"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-[0.875rem] tabular-nums text-ink">
                {formatMoney(row.amountCents)}
              </span>
              <StateStamp state={row.state} />
            </div>
            <p className="mt-2 text-[0.9375rem] font-medium leading-[1.35] text-ink">
              {row.title}
            </p>
            <p className="mt-0.5 text-[0.8125rem] text-ink-muted">
              Buyer: {row.buyerName}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-sm border border-flagged bg-flagged-wash px-2 py-1 text-[0.8125rem] font-medium leading-none text-flagged">
                <Flag aria-hidden="true" size={16} strokeWidth={1.75} />
                {row.reasonLabel}
              </span>
              <span className="font-mono text-[0.75rem] tabular-nums text-ink-muted">
                {row.age}
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function EmptyQueue() {
  return (
    <div className="rounded-lg border border-rule-line bg-sheet p-8 text-center">
      <Inbox
        aria-hidden="true"
        size={24}
        strokeWidth={1.75}
        className="mx-auto text-ink-muted"
      />
      <h2 className="mt-3 text-[1rem] font-medium text-ink">No cases waiting</h2>
      <p className="mx-auto mt-1 max-w-[46ch] text-[0.875rem] leading-[1.55] text-ink-muted">
        A deal appears here only when a rule, a technical failure or an out-of-band
        reversal sends it to a person. The money stays held until then.
      </p>
    </div>
  );
}

function QueueLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="overflow-hidden rounded-lg border border-rule-line bg-sheet"
    >
      <span className="sr-only">Loading the mediation queue</span>
      <div aria-hidden="true" className="h-11 border-b border-rule-line bg-kraft" />
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          aria-hidden="true"
          className="flex h-16 items-center gap-4 border-b border-rule-line px-4 last:border-b-0"
        >
          <div className="h-4 flex-1 rounded-sm bg-kraft" />
          <div className="h-4 w-20 rounded-sm bg-kraft" />
          <div className="h-4 w-28 rounded-sm bg-kraft" />
        </div>
      ))}
    </div>
  );
}
