import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { connection } from "next/server";
import { AppBar } from "@/components/app-bar";
import { AuditReport } from "@/components/audit-report";
import { EvidenceSlot } from "@/components/evidence-slot";
import { HoldingSlip } from "@/components/holding-slip";
import { Button } from "@/components/ui/button";
import { getDemoDeal } from "@/demo/data";
import { formatDeadline } from "@/lib/deals/deadline";
import { formatMoney } from "@/lib/deals/money";
import { dealIdSchema } from "@/lib/deals/schema";
import type { DealView } from "@/lib/deals/types";
import { getTrustLinkDeal } from "@/lib/db/deal-store";
import { isSupabaseConfigured } from "@/lib/db/server";

export default function TrustLinkPage({ params }: PageProps<"/t/[id]">) {
  return (
    <div className="min-h-[100dvh] bg-paper">
      <AppBar right="Buyer view" />
      <main className="mx-auto w-full max-w-[640px] px-4 pb-20 pt-6 md:px-6">
        <Suspense fallback={<TrustLinkSkeleton />}>
          <TrustLinkContent params={params} />
        </Suspense>
      </main>
    </div>
  );
}

async function TrustLinkContent({
  params,
}: Pick<PageProps<"/t/[id]">, "params">) {
  await connection();
  const { id } = await params;

  if (!dealIdSchema.safeParse(id).success) notFound();

  let deal: DealView | null = null;
  let loadFailed = false;

  if (isSupabaseConfigured()) {
    try {
      deal = await getTrustLinkDeal(id);
    } catch (error) {
      console.error("Could not load the Trust Link deal", error);
      loadFailed = true;
    }
  } else {
    deal = getDemoDeal(id);
  }

  if (loadFailed) return <TrustLinkLoadError />;

  if (!deal) notFound();

  const deadline = deal.autoReleaseAt ? formatDeadline(deal.autoReleaseAt) : undefined;
  const sellerEvidence = deal.evidence.filter((item) => item.slot !== "D");

  return (
    <div className="space-y-8">
      <HoldingSlip
        amountCents={deal.priceCents}
        state={deal.state}
        deadline={deadline}
      />

      <section aria-labelledby="deal-title" className="space-y-3">
        <p className="text-[0.8125rem] font-medium text-ink-muted">Trust Link</p>
        <h1
          id="deal-title"
          className="text-[1.5rem] font-semibold leading-[1.2] tracking-[-0.015em] text-ink"
        >
          {deal.title}
        </h1>
        <p className="text-[0.9375rem] text-ink-muted">
          Sold by {deal.seller.displayName} to {deal.buyer.displayName}.
        </p>
        <p className="max-w-[65ch] text-[1rem] leading-[1.55] text-ink">
          {deal.description}
        </p>
      </section>

      <section className="rounded-lg border border-rule-line bg-kraft p-4">
        <p className="max-w-[65ch] text-[0.9375rem] leading-[1.55] text-ink">
          We are holding {formatMoney(deal.priceCents)} until the buyer confirms the
          parcel arrived. If something is wrong, the buyer can open a dispute before
          the deadline. No money moves on its own while a rule or a person is reviewing
          the case.
        </p>
      </section>

      <BuyerAction deal={deal} />

      <section aria-labelledby="evidence-heading" className="space-y-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2
            id="evidence-heading"
            className="text-[1.125rem] font-semibold leading-[1.35] text-ink"
          >
            Seller evidence
          </h2>
          <span className="text-[0.8125rem] text-ink-muted">
            {sellerEvidence.length} photos
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {sellerEvidence.map((item) => (
            <EvidenceSlot key={item.slot} evidence={item} />
          ))}
        </div>
      </section>

      {deal.audit ? (
        <AuditReport audit={deal.audit} />
      ) : (
        <section aria-labelledby="audit-empty-heading" className="space-y-2">
          <h2
            id="audit-empty-heading"
            className="text-[1.125rem] font-semibold leading-[1.35] text-ink"
          >
            Audit report
          </h2>
          <p className="text-[0.9375rem] leading-[1.55] text-ink-muted">
            The photos have not been audited yet. Nothing moves until the record is
            written.
          </p>
        </section>
      )}

      <footer className="border-t border-rule-line pt-5 text-[0.8125rem] leading-[1.5] text-ink-muted">
        Sandbox demo. No real money moves.
      </footer>
    </div>
  );
}

function BuyerAction({ deal }: { deal: DealView }) {
  if (deal.state === "AWAITING_PAYMENT") {
    return (
      <section aria-labelledby="buyer-action-heading" className="space-y-3">
        <h2
          id="buyer-action-heading"
          className="text-[1.125rem] font-semibold leading-[1.35] text-ink"
        >
          The buyer&apos;s next step
        </h2>
        <p className="max-w-[65ch] text-[0.9375rem] leading-[1.55] text-ink">
          {deal.seller.displayName} is waiting for the payment of{" "}
          <span className="font-mono tabular-nums">
            {formatMoney(deal.priceCents)}
          </span>
          . This demo build does not process the payment yet; the checkout goal
          is to show the deal and its evidence before the money moves.
        </p>
      </section>
    );
  }

  if (deal.state === "SHIPPED") {
    return (
      <section aria-labelledby="buyer-action-heading" className="space-y-3">
        <h2
          id="buyer-action-heading"
          className="text-[1.125rem] font-semibold leading-[1.35] text-ink"
        >
          The buyer&apos;s next step
        </h2>
        <Button type="button" disabled aria-describedby="buyer-action-note">
          Confirm receipt of {formatMoney(deal.priceCents)}
        </Button>
        <p
          id="buyer-action-note"
          className="max-w-[65ch] text-[0.875rem] leading-[1.55] text-ink-muted"
        >
          Payment actions are not connected in this build. When they are, this releases
          the money to {deal.seller.displayName} only after the payment provider confirms
          the payout.
        </p>
      </section>
    );
  }

  if (deal.state === "EVIDENCE_REJECTED") {
    return (
      <section aria-labelledby="buyer-action-heading" className="space-y-2">
        <h2
          id="buyer-action-heading"
          className="text-[1.125rem] font-semibold leading-[1.35] text-ink"
        >
          Shipping is blocked
        </h2>
        <p className="max-w-[65ch] text-[0.9375rem] leading-[1.55] text-ink-muted">
          {deal.seller.displayName} needs to upload clearer evidence. The money stays
          held and no tracking is attached until the audit passes.
        </p>
      </section>
    );
  }

  if (deal.state === "ESCALATED") {
    return (
      <section aria-labelledby="buyer-action-heading" className="space-y-2">
        <h2
          id="buyer-action-heading"
          className="text-[1.125rem] font-semibold leading-[1.35] text-ink"
        >
          With a mediator
        </h2>
        <p className="max-w-[65ch] text-[0.9375rem] leading-[1.55] text-ink-muted">
          A person is reviewing both sides of the evidence. The money stays held until
          the mediator releases it or refunds the buyer.
        </p>
      </section>
    );
  }

  return null;
}

function TrustLinkSkeleton() {
  return (
    <div className="space-y-8" role="status" aria-live="polite">
      <span className="sr-only">Loading the deal</span>
      <div aria-hidden="true" className="h-44 rounded-lg border border-rule-line bg-kraft" />
      <div aria-hidden="true" className="space-y-3">
        <div className="h-3 w-24 rounded-sm bg-kraft" />
        <div className="h-8 w-2/3 rounded-sm bg-kraft" />
        <div className="h-4 w-1/2 rounded-sm bg-kraft" />
      </div>
      <div aria-hidden="true" className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-64 rounded-lg border border-rule-line bg-kraft" />
        ))}
      </div>
      <div aria-hidden="true" className="h-64 rounded-lg border border-rule-line bg-kraft" />
    </div>
  );
}

function TrustLinkLoadError() {
  return (
    <section
      role="alert"
      className="space-y-2 rounded-lg border border-blocked bg-blocked-wash p-4"
    >
      <div className="flex items-center gap-2 text-blocked">
        <AlertCircle aria-hidden="true" size={16} strokeWidth={1.75} />
        <h2 className="text-[1.125rem] font-semibold leading-[1.35]">
          This deal could not be loaded
        </h2>
      </div>
      <p className="max-w-[65ch] text-[0.9375rem] leading-[1.55] text-ink">
        The database answered with an error. Ask the seller for the link again
        later; no money moves while the deal is unavailable.
      </p>
    </section>
  );
}
