import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { AppBar } from "@/components/app-bar";
import { AuditReport } from "@/components/audit-report";
import { AuditWatcher } from "@/components/audit-watcher";
import { EvidenceSlot } from "@/components/evidence-slot";
import { HoldingSlip } from "@/components/holding-slip";
import { RoleSwitcher } from "@/components/role-switcher";
import { EvidenceUploadForm } from "@/components/seller/evidence-upload-form";
import { getDemoDeal } from "@/demo/data";
import { getTrustLinkDeal } from "@/lib/db/deal-store";
import { isSupabaseConfigured } from "@/lib/db/server";
import { formatDeadline } from "@/lib/deals/deadline";
import { dealIdSchema } from "@/lib/deals/schema";
import type { DealView } from "@/lib/deals/types";

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
  const canUpload =
    isSupabaseConfigured() && (deal.state === "FUNDS_HELD" || deal.state === "EVIDENCE_REJECTED");

  return (
    <div className="mt-4 space-y-8">
      <RoleSwitcher dealId={deal.id} state={deal.state} active="seller" />
      <HoldingSlip
        amountCents={deal.priceCents}
        state={deal.state}
        deadline={deal.autoReleaseAt ? formatDeadline(deal.autoReleaseAt) : undefined}
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

      <SellerNextStep deal={deal} />

      {canUpload ? <EvidenceUploadForm dealId={deal.id} /> : null}

      {deal.state === "AUDITING" ? (
        <>
          <AuditWatcher />
          <AuditRunning />
        </>
      ) : null}
      {deal.state === "ARBITRATING" ? <AuditWatcher /> : null}

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

      {deal.audit && deal.state !== "AUDITING" ? <AuditReport audit={deal.audit} /> : null}

      <footer className="border-t border-rule-line pt-5 text-[0.8125rem] leading-[1.5] text-ink-muted">
        Sandbox demo. No real money moves.
      </footer>
    </div>
  );
}

function SellerNextStep({ deal }: { deal: DealView }) {
  const copy: Partial<Record<DealView["state"], { title: string; body: string }>> = {
    AWAITING_PAYMENT: {
      title: "Share the Trust Link",
      body: `${deal.buyer.displayName} pays through the Trust Link. You upload the evidence once the money is held.`,
    },
    EVIDENCE_REJECTED: {
      title: "Upload clearer photos",
      body: "The last audit could not clear the parcel. Check the report below and send all three photos again.",
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
      body: "The buyer's unboxing photo is being compared with your evidence. If they disagree, a person decides.",
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
