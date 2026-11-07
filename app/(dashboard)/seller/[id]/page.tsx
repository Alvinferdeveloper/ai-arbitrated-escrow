import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { AppBar } from "@/components/app-bar";
import { AiRetakeRequest } from "@/components/ai-retake-request";
import { AuditReport } from "@/components/audit-report";
import { DealOutcomeSection } from "@/components/deal-outcome";
import { ExampleDealNotice } from "@/components/example-deal-notice";
import { VerificationCodeCard } from "@/components/verification-code-card";
import { DealLiveUpdates } from "@/components/deal-live-updates";
import { EvidenceSlot } from "@/components/evidence-slot";
import { HoldingSlip } from "@/components/holding-slip";
import { RoleSwitcher } from "@/components/role-switcher";
import { EvidenceUploadForm } from "@/components/seller/evidence-upload-form";
import { getDemoDeal } from "@/demo/data";
import { getTrustLinkDeal } from "@/lib/db/deal-store";
import { isSupabaseConfigured } from "@/lib/db/server";
import { holdingSlipDeadline, isPast } from "@/lib/deals/deadline";
import { dealOutcome } from "@/lib/deals/story";
import { dealIdSchema } from "@/lib/deals/schema";
import type { DealView } from "@/lib/deals/types";
import { isWaitingOnSystem } from "@/lib/state-machine/presentation";

export default function SellerDealPage({ params }: PageProps<"/seller/[id]">) {
  return (
    <div className="min-h-[100dvh] bg-paper">
      <AppBar right="Seller view" />
      <main className="mx-auto w-full max-w-[640px] px-4 pb-20 pt-6 md:px-6">
        <Link
          href="/seller"
          className="inline-flex items-center gap-1.5 rounded-sm text-[0.8125rem] font-medium text-postal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-postal-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
        >
          <ArrowLeft aria-hidden="true" size={16} strokeWidth={1.75} />
          Create another deal
        </Link>
        <Suspense fallback={<SellerDealSkeleton />}>
          <SellerDealContent params={params} />
        </Suspense>
      </main>
    </div>
  );
}

async function SellerDealContent({ params }: Pick<PageProps<"/seller/[id]">, "params">) {
  await connection();
  const { id } = await params;
  if (!dealIdSchema.safeParse(id).success) notFound();

  let deal: DealView | null;
  try {
    deal = isSupabaseConfigured() ? await getTrustLinkDeal(id) : getDemoDeal(id);
  } catch (error) {
    console.error("Could not load the seller deal", error);
    return <SellerDealLoadError />;
  }
  if (!deal) notFound();

  const sellerEvidence = deal.evidence.filter((item) => item.slot !== "D");
  // Past the deadline the cron refunds the buyer; the upload route refuses too.
  const deadlinePassed = isPast(deal.evidenceDueAt);
  const canUpload =
    isSupabaseConfigured() &&
    !deal.isExample &&
    !deadlinePassed &&
    (deal.state === "FUNDS_HELD" || deal.state === "EVIDENCE_REJECTED");
  // After a rejection the seller needs the reasons before the upload slots.
  const rejectedAudit = deal.state === "EVIDENCE_REJECTED" ? deal.audit : null;
  const outcome = dealOutcome(
    {
      state: deal.state,
      priceCents: deal.priceCents,
      sellerName: deal.seller.displayName,
      closedFrom: deal.closedFrom,
      refundReason: deal.refundReason,
    },
    "seller",
  );

  return (
    <div className="mt-4 space-y-8">
      <DealLiveUpdates dealId={deal.id} waiting={isWaitingOnSystem(deal.state)} />
      <RoleSwitcher dealId={deal.id} state={deal.state} active="seller" />
      {deal.isExample ? <ExampleDealNotice actions="uploads" /> : null}
      <HoldingSlip
        amountCents={deal.priceCents}
        state={deal.state}
        deadline={deal.isExample ? undefined : holdingSlipDeadline(deal)}
        audience="seller"
      />

      <section aria-labelledby="deal-title" className="space-y-2">
        <h1
          id="deal-title"
          className="text-[1.5rem] font-semibold leading-[1.2] tracking-[-0.015em] text-ink"
        >
          {deal.title}
        </h1>
        <p className="text-[0.9375rem] text-ink-muted">
          You are selling to {deal.buyer.displayName}.{" "}
          <Link
            href={`/t/${deal.id}`}
            className="rounded-sm font-medium text-postal-ink underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-postal-ink"
          >
            Open the Trust Link
          </Link>
        </p>
        {deal.trackingNumber ? (
          <p className="font-mono text-[0.875rem] tabular-nums text-ink-muted">
            {deal.carrier ?? "Carrier"} {deal.trackingNumber}
          </p>
        ) : null}
      </section>

      {outcome ? <DealOutcomeSection outcome={outcome} /> : <SellerNextStep deal={deal} />}

      {deal.state === "EVIDENCE_REJECTED" && deal.aiDecision && !deadlinePassed ? (
        <AiRetakeRequest decision={deal.aiDecision} />
      ) : null}

      {rejectedAudit ? <AuditReport audit={rejectedAudit} /> : null}

      {canUpload && deal.verificationCode ? (
        <VerificationCodeCard
          code={deal.verificationCode}
          audience="seller"
          isSample={deal.isSample}
        />
      ) : null}

      {canUpload ? <EvidenceUploadForm dealId={deal.id} isSample={deal.isSample} /> : null}

      {deal.state === "AUDITING" ? <AuditRunning /> : null}

      {deal.audit && deal.state !== "AUDITING" && !rejectedAudit ? (
        <AuditReport audit={deal.audit} />
      ) : null}

      {!canUpload && sellerEvidence.some((item) => item.status === "uploaded") ? (
        <section aria-labelledby="evidence-heading" className="space-y-4">
          <h2
            id="evidence-heading"
            className="text-[1.125rem] font-semibold leading-[1.35] text-ink"
          >
            Your evidence
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {sellerEvidence.map((item) => (
              <EvidenceSlot key={item.slot} evidence={item} />
            ))}
          </div>
        </section>
      ) : null}

      <footer className="border-t border-rule-line pt-5 text-[0.8125rem] leading-[1.5] text-ink-muted">
        Sandbox demo. No real money moves.
      </footer>
    </div>
  );
}

function SellerNextStep({ deal }: { deal: DealView }) {
  if (isPast(deal.evidenceDueAt)) {
    return (
      <section className="space-y-1 rounded-lg border border-rule-line bg-kraft p-4">
        <h2 className="text-[0.9375rem] font-semibold leading-[1.35] text-ink">The deadline passed</h2>
        <p className="max-w-[65ch] text-[0.9375rem] leading-[1.55] text-ink">
          No valid photos arrived in time, so uploads are closed and the AI is refunding the buyer.
        </p>
      </section>
    );
  }

  const copy: Partial<Record<DealView["state"], { title: string; body: string }>> = {
    AWAITING_PAYMENT: {
      title: "Share the Trust Link",
      body: `${deal.buyer.displayName} pays through the Trust Link. You upload the evidence once the money is held.`,
    },
    FUNDS_HELD: {
      title: "Upload the evidence",
      body: "The money is held. Send photos A, B and C before the deadline in the slip above, or the AI refunds the buyer.",
    },
    EVIDENCE_REJECTED: {
      title: "Retake the photos",
      body: deal.aiDecision?.retakes.length
        ? "Send all three photos again with the changes below, before the deadline in the slip above."
        : "Send all three photos again before the deadline in the slip above. The audit report shows what did not pass.",
    },
    SHIPPED: {
      title: "Send the parcel",
      body: `The evidence passed. The money is released when ${deal.buyer.displayName} confirms receipt or the deadline passes.`,
    },
    DISPUTED: {
      title: "The buyer opened a dispute",
      body: `${deal.buyer.displayName} reported a problem with the parcel. The money stays held while their unboxing photo is compared with your evidence.`,
    },
    ARBITRATING: {
      title: "Comparing both sides",
      body: "The buyer's unboxing photo is being compared with your evidence. If they contradict each other, a mediator decides.",
    },
    ESCALATED: {
      title: "With a mediator",
      body: "A person is reviewing the case. The money stays held until they decide.",
    },
  };

  const entry = copy[deal.state];
  if (!entry) return null;

  return (
    <section className="space-y-1 rounded-lg border border-rule-line bg-kraft p-4">
      <h2 className="text-[0.9375rem] font-semibold leading-[1.35] text-ink">{entry.title}</h2>
      <p className="max-w-[65ch] text-[0.9375rem] leading-[1.55] text-ink">{entry.body}</p>
    </section>
  );
}

const AUDIT_STEPS = [
  "Comparing the product with the listing",
  "Checking the product inside the packing",
  "Checking the seal and the shipping guide",
  "Reading the shipping guide",
  "Checking the verification code and the photo history",
];

function AuditRunning() {
  return (
    <section aria-labelledby="audit-running-heading" className="space-y-4" aria-live="polite">
      <div>
        <h2
          id="audit-running-heading"
          className="text-[1.125rem] font-semibold leading-[1.35] text-ink"
        >
          Audit in progress
        </h2>
        <p className="mt-1 max-w-[65ch] text-[0.9375rem] leading-[1.55] text-ink-muted">
          This page updates by itself. Nothing moves until the record is written.
        </p>
      </div>
      <ul className="divide-y divide-rule-line rounded-lg border border-rule-line bg-sheet">
        {AUDIT_STEPS.map((step) => (
          <li key={step} className="flex items-center gap-3 p-4">
            <span aria-hidden="true" className="h-4 w-4 animate-pulse rounded-full bg-kraft" />
            <span className="text-[0.9375rem] text-ink-muted">{step}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SellerDealSkeleton() {
  return (
    <div className="mt-4 space-y-8" role="status" aria-live="polite">
      <span className="sr-only">Loading the deal</span>
      <div aria-hidden="true" className="h-44 rounded-lg border border-rule-line bg-kraft" />
      <div aria-hidden="true" className="space-y-3">
        <div className="h-8 w-2/3 rounded-sm bg-kraft" />
        <div className="h-4 w-1/2 rounded-sm bg-kraft" />
      </div>
      <div aria-hidden="true" className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-72 rounded-lg border border-rule-line bg-kraft" />
        ))}
      </div>
    </div>
  );
}

function SellerDealLoadError() {
  return (
    <section role="alert" className="mt-4 space-y-2 rounded-lg border border-blocked bg-blocked-wash p-4">
      <div className="flex items-center gap-2 text-blocked">
        <AlertCircle aria-hidden="true" size={16} strokeWidth={1.75} />
        <h2 className="text-[1.125rem] font-semibold leading-[1.35]">
          This deal could not be loaded
        </h2>
      </div>
      <p className="max-w-[65ch] text-[0.9375rem] leading-[1.55] text-ink">
        The database answered with an error. Reload in a moment; the money stays held.
      </p>
    </section>
  );
}
