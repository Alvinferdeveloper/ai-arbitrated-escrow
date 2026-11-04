import { connection } from "next/server";
import { MediationQueue } from "@/components/mediation/mediation-queue";
import { getMediationQueueRows } from "@/lib/mediation/repository";

export default async function MediatorQueuePage() {
  await connection();
  const rows = await getMediationQueueRows();

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[0.8125rem] font-medium text-ink-muted">
          Mediator desk
        </p>
        <h1 className="mt-2 text-[1.75rem] font-semibold leading-[1.15] tracking-[-0.02em] text-ink">
          Mediation queue
        </h1>
        <p className="mt-3 max-w-[65ch] text-[1rem] leading-[1.55] text-ink">
          The cases the AI could not settle: evidence that contradicts itself, an audit
          that failed twice, or a payment reversed outside the deal. The money stays held
          until you decide.
        </p>
      </header>

      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-rule-line pb-3">
        <p className="text-[0.8125rem] font-medium text-ink-muted">
          {rows.length} open {rows.length === 1 ? "case" : "cases"}
        </p>
        <p className="text-[0.8125rem] text-ink-muted">
          Oldest first. Select a row to open the case file.
        </p>
      </div>

      <MediationQueue rows={rows} />

      <p className="max-w-[65ch] text-[0.8125rem] leading-[1.5] text-ink-muted">
        Sandbox. The queue reads escalated deals; real money is never involved.
      </p>
    </div>
  );
}
