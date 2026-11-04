import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import {
  ArrowLeft,
  ArrowRight,
  Flag,
  ShieldAlert,
} from "lucide-react";
import { AuditReport } from "@/components/audit-report";
import { EvidenceSlot } from "@/components/evidence-slot";
import { HoldingSlip } from "@/components/holding-slip";
import { CaseTimeline } from "@/components/mediation/case-timeline";
import { MediatorActions } from "@/components/mediation/mediator-actions";
import { ExampleDealNotice } from "@/components/example-deal-notice";
import { DealLiveUpdates } from "@/components/deal-live-updates";
import { RoleSwitcher } from "@/components/role-switcher";
import { ESCALATION_RULE_LABELS } from "@/lib/agents/rules.config";
import { formatCaseAge } from "@/lib/mediation/age";
import { getMediationCaseById } from "@/lib/mediation/repository";
import type { MediationCase } from "@/lib/mediation/types";

export default async function MediatorCasePage({
  params,
}: PageProps<"/mediator/[id]">) {
  await connection();
  const { id } = await params;
  const caseFile = await getMediationCaseById(id);

  if (!caseFile) notFound();

  return (
    <div className="space-y-8">
      <Link
        href="/mediator"
        className="inline-flex items-center gap-1.5 rounded-sm text-[0.8125rem] font-medium text-postal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-postal-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
      >
        <ArrowLeft aria-hidden="true" size={16} strokeWidth={1.75} />
        Back to queue
      </Link>

      <DealLiveUpdates dealId={caseFile.id} waiting={caseFile.settlement !== null} />
      <RoleSwitcher dealId={caseFile.id} state={caseFile.state} active="mediator" />
      {caseFile.isExample ? <ExampleDealNotice actions="the decisions" /> : null}

      <HoldingSlip
        amountCents={caseFile.priceCents}
        state={caseFile.state}
        deadline={`Opened ${formatCaseAge(caseFile.openedAt)} ago`}
      />

      <header className="space-y-3">
        <p className="text-[0.8125rem] font-medium text-ink-muted">Case file</p>
        <h1 className="text-[1.5rem] font-semibold leading-[1.2] tracking-[-0.015em] text-ink">
          {caseFile.title}
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-[0.875rem] text-ink-muted">
          <span>{caseFile.seller.displayName}</span>
          <ArrowRight aria-hidden="true" size={14} strokeWidth={1.75} />
          <span>{caseFile.buyer.displayName}</span>
        </div>
      </header>

      <section
        aria-labelledby="reason-heading"
        className="space-y-2 rounded-lg border border-flagged bg-flagged-wash p-4"
      >
        <h2
          id="reason-heading"
          className="flex items-center gap-2 text-[0.9375rem] font-semibold leading-[1.35] text-flagged"
        >
          <Flag aria-hidden="true" size={18} strokeWidth={1.75} className="shrink-0" />
          Why the AI handed this to you: {ESCALATION_RULE_LABELS[caseFile.reason].toLowerCase()}
        </h2>
        <p className="max-w-[65ch] text-[0.9375rem] leading-[1.55] text-ink">{caseFile.summary}</p>
      </section>

      <div className="space-y-8 lg:grid lg:grid-cols-[minmax(0,1fr)_17.5rem] lg:items-start lg:gap-8 lg:space-y-0">
        <div className="min-w-0 space-y-8">
          <EvidenceComparison caseFile={caseFile} />

          <div className="lg:hidden">
            <Decision caseFile={caseFile} />
          </div>

          {caseFile.audit ? (
            <details className="group rounded-lg border border-rule-line bg-sheet">
              <summary className="flex min-h-11 cursor-pointer items-center px-4 text-[0.9375rem] font-medium text-ink marker:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-postal-ink">
                Pre-shipment audit of the seller&apos;s photos
              </summary>
              <div className="border-t border-rule-line p-4">
                <AuditReport audit={caseFile.audit} />
              </div>
            </details>
          ) : (
            <section className="flex gap-3 rounded-md border border-blocked bg-blocked-wash p-4">
              <ShieldAlert
                aria-hidden="true"
                size={18}
                strokeWidth={1.75}
                className="mt-0.5 shrink-0 text-blocked"
              />
              <p className="text-[0.9375rem] leading-[1.55] text-ink">
                The AI audit failed before it could write a report, so nothing shipped on its
                findings. Read the photos yourself.
              </p>
            </section>
          )}

          <CaseTimeline entries={caseFile.timeline} />
        </div>

        <aside className="hidden lg:sticky lg:top-20 lg:block">
          <Decision caseFile={caseFile} />
        </aside>
      </div>

      <footer className="border-t border-rule-line pt-5 text-[0.8125rem] leading-[1.5] text-ink-muted">
        Sandbox demo. A release or refund waits until PayPal confirms it.
      </footer>
    </div>
  );
}

function Decision({ caseFile }: { caseFile: MediationCase }) {
  if (caseFile.isExample) {
    return (
      <section className="space-y-1 rounded-lg border border-rule-line bg-kraft p-4">
        <h2 className="text-[1.125rem] font-semibold leading-[1.35] text-ink">Decision</h2>
        <p className="text-[0.9375rem] leading-[1.55] text-ink-muted">
          Switched off on example deals.
        </p>
      </section>
    );
  }

  return (
    <MediatorActions
      caseId={caseFile.id}
      amountCents={caseFile.priceCents}
      sellerName={caseFile.seller.displayName}
      buyerName={caseFile.buyer.displayName}
      settlement={caseFile.settlement}
      canApproveShipping={caseFile.canApproveShipping}
    />
  );
}

/** The two photos in conflict side by side; the rest of the seller's evidence below. */
function EvidenceComparison({ caseFile }: { caseFile: MediationCase }) {
  const parcel = caseFile.sellerEvidence.find((item) => item.slot === "C");
  const unboxing = caseFile.buyerEvidence[0];
  const others = caseFile.sellerEvidence.filter((item) => !(unboxing && item.slot === "C"));

  return (
    <section aria-labelledby="evidence-heading" className="space-y-4">
      <h2 id="evidence-heading" className="text-[1.125rem] font-semibold leading-[1.35] text-ink">
        {unboxing ? "What was sent and what arrived" : "Seller evidence"}
      </h2>

      {unboxing && parcel ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="min-w-0 space-y-2">
              <p className="text-[0.8125rem] font-medium text-ink-muted">
                {caseFile.seller.displayName} sealed it
              </p>
              <EvidenceSlot evidence={parcel} />
            </div>
            <div className="min-w-0 space-y-2">
              <p className="text-[0.8125rem] font-medium text-ink-muted">
                {caseFile.buyer.displayName} opened it
              </p>
              <EvidenceSlot evidence={unboxing} />
            </div>
          </div>
          <blockquote className="rounded-md border border-rule-line bg-sheet p-3 text-[0.9375rem] leading-[1.55] text-ink">
            <span className="text-[0.8125rem] font-medium text-ink-muted">
              {caseFile.buyer.displayName}&apos;s claim
            </span>
            <span className="mt-1 block">&ldquo;{caseFile.claim}&rdquo;</span>
          </blockquote>
        </>
      ) : (
        <p className="max-w-[65ch] text-[0.9375rem] leading-[1.55] text-ink-muted">
          {caseFile.claim}
        </p>
      )}

      {others.length > 0 ? (
        <div className="space-y-2">
          {unboxing ? (
            <p className="text-[0.8125rem] font-medium text-ink-muted">
              The seller&apos;s other photos
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            {others.map((item) => (
              <EvidenceSlot key={item.slot} evidence={item} />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
