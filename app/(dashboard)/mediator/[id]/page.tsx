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
import { DealLiveUpdates } from "@/components/deal-live-updates";
import { RoleSwitcher } from "@/components/role-switcher";
import { ESCALATION_RULE_LABELS } from "@/lib/agents/rules.config";
import { formatCaseAge } from "@/lib/mediation/age";
import { getMediationCaseById } from "@/lib/mediation/repository";

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

      <section className="rounded-lg border border-flagged bg-flagged-wash p-4">
        <div className="flex gap-3">
          <Flag
            aria-hidden="true"
            size={18}
            strokeWidth={1.75}
            className="mt-0.5 shrink-0 text-flagged"
          />
          <div>
            <p className="text-[0.8125rem] font-medium text-flagged">
              {ESCALATION_RULE_LABELS[caseFile.reason]}
            </p>
            <p className="mt-1 text-[0.9375rem] leading-[1.55] text-ink">
              {caseFile.reasonDetail}
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="summary-heading" className="space-y-2">
        <h2
          id="summary-heading"
          className="text-[1.125rem] font-semibold leading-[1.35] text-ink"
        >
          Why a person is reviewing this
        </h2>
        <p className="max-w-[65ch] text-[0.9375rem] leading-[1.55] text-ink">
          {caseFile.summary}
        </p>
      </section>

      <section aria-labelledby="claim-heading" className="space-y-2">
        <h2
          id="claim-heading"
          className="text-[1.125rem] font-semibold leading-[1.35] text-ink"
        >
          Buyer&apos;s claim
        </h2>
        <p className="max-w-[65ch] border-l border-rule-line pl-4 text-[0.9375rem] leading-[1.55] text-ink">
          {caseFile.claim}
        </p>
      </section>

      <CaseTimeline entries={caseFile.timeline} />

      <section aria-labelledby="seller-evidence-heading" className="space-y-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2
            id="seller-evidence-heading"
            className="text-[1.125rem] font-semibold leading-[1.35] text-ink"
          >
            Seller evidence
          </h2>
          <span className="text-[0.8125rem] text-ink-muted">
            {caseFile.sellerEvidence.length} photos
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {caseFile.sellerEvidence.map((item) => (
            <EvidenceSlot key={item.slot} evidence={item} />
          ))}
        </div>
      </section>

      <section aria-labelledby="buyer-evidence-heading" className="space-y-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2
            id="buyer-evidence-heading"
            className="text-[1.125rem] font-semibold leading-[1.35] text-ink"
          >
            Buyer evidence
          </h2>
          <span className="text-[0.8125rem] text-ink-muted">
            {caseFile.buyerEvidence.length} photos
          </span>
        </div>
        {caseFile.buyerEvidence.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {caseFile.buyerEvidence.map((item) => (
              <EvidenceSlot key={item.slot} evidence={item} />
            ))}
          </div>
        ) : (
          <p className="max-w-[65ch] text-[0.9375rem] leading-[1.55] text-ink-muted">
            The buyer has not uploaded unboxing evidence yet. The money stays held
            while the mediator waits.
          </p>
        )}
      </section>

      {caseFile.audit ? (
        <AuditReport audit={caseFile.audit} />
      ) : (
        <section aria-labelledby="audit-failure-heading" className="space-y-3">
          <h2
            id="audit-failure-heading"
            className="text-[1.125rem] font-semibold leading-[1.35] text-ink"
          >
            Audit report
          </h2>
          <div className="flex gap-3 rounded-md border border-blocked bg-blocked-wash p-4">
            <ShieldAlert
              aria-hidden="true"
              size={18}
              strokeWidth={1.75}
              className="mt-0.5 shrink-0 text-blocked"
            />
            <p className="text-[0.9375rem] leading-[1.55] text-ink">
              The vision check failed before it could write a report. No shipping
              decision was made from model output, so a person reads the evidence.
            </p>
          </div>
        </section>
      )}

      <MediatorActions
        caseId={caseFile.id}
        amountCents={caseFile.priceCents}
        sellerName={caseFile.seller.displayName}
        buyerName={caseFile.buyer.displayName}
        settlement={caseFile.settlement}
        canApproveShipping={caseFile.canApproveShipping}
      />

      <footer className="border-t border-rule-line pt-5 text-[0.8125rem] leading-[1.5] text-ink-muted">
        Sandbox. A release or refund is queued until PayPal confirms it. The state
        machine is the only code that starts a payment.
      </footer>
    </div>
  );
}
