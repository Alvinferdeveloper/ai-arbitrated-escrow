import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { connection } from "next/server";
import { AppBar } from "@/components/app-bar";
import { AuditReport } from "@/components/audit-report";
import { AuditWatcher } from "@/components/audit-watcher";
import { ConfirmReceiptForm } from "@/components/buyer/confirm-receipt-form";
import { StartCheckoutForm } from "@/components/buyer/start-checkout-form";
import { EvidenceSlot } from "@/components/evidence-slot";
import { HoldingSlip } from "@/components/holding-slip";
import { getDemoDeal } from "@/demo/data";
import { formatDeadline } from "@/lib/deals/deadline";
import { formatMoney } from "@/lib/deals/money";
import { dealIdSchema } from "@/lib/deals/schema";
import type { DealView } from "@/lib/deals/types";
import { getCapturePayment } from "@/lib/db/checkout-store";
import { getTrustLinkDeal } from "@/lib/db/deal-store";
import { isSupabaseConfigured } from "@/lib/db/server";
import { isPayPalConfigured } from "@/lib/paypal/config";

export default function TrustLinkPage({
  params,
  searchParams,
}: PageProps<"/t/[id]">) {
  return (
    <div className="min-h-[100dvh] bg-paper">
      <AppBar right="Buyer view" />
      <main className="mx-auto w-full max-w-[640px] px-4 pb-20 pt-6 md:px-6">
        <Suspense fallback={<TrustLinkSkeleton />}>
          <TrustLinkContent params={params} searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

async function TrustLinkContent({
  params,
  searchParams,
}: Pick<PageProps<"/t/[id]">, "params" | "searchParams">) {
  await connection();
  const [{ id }, query] = await Promise.all([params, searchParams]);

  if (!dealIdSchema.safeParse(id).success) notFound();

  let deal: DealView | null = null;
  let captureStatus: string | null = null;
  let loadFailed = false;

  if (isSupabaseConfigured()) {
    try {
      deal = await getTrustLinkDeal(id);

      if (deal?.state === "AWAITING_PAYMENT") {
        captureStatus = (await getCapturePayment(id))?.status ?? null;
      }
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

  const paymentResult =
    typeof query.payment === "string" ? query.payment : undefined;
  const paymentInProgress =
    captureStatus === "APPROVED" ||
    captureStatus === "PENDING" ||
    captureStatus === "COMPLETED";
  const notice =
    paymentResult ??
    (paymentInProgress ? "processing" : undefined);

  return (
    <div className="space-y-8">
      <HoldingSlip
        amountCents={deal.priceCents}
        state={deal.state}
        deadline={deadline}
      />

      <PaymentNotice status={notice} />
      {deal.state === "AUDITING" ? <AuditWatcher /> : null}

      <section aria-labelledby="deal-title" className="space-y-3">
        <p className="text-[0.8125rem] font-medium text-ink-muted">Trust Link</p>
        <h1
          id="deal-title"
          className="text-[1.5rem] font-semibold leading-[1.2] tracking-[-0.015em] text-ink"
        >
          {deal.title}
        </h1>
        <p className="text-[0.9375rem] text-ink-muted">
          Sold to you by {deal.seller.displayName}.
        </p>
        <p className="max-w-[65ch] text-[1rem] leading-[1.55] text-ink">
          {deal.description}
        </p>
      </section>

      <section className="rounded-lg border border-rule-line bg-kraft p-4">
        <p className="max-w-[65ch] text-[0.9375rem] leading-[1.55] text-ink">
          We are holding {formatMoney(deal.priceCents)} until you confirm the parcel
          arrived. If something is wrong, you can open a dispute before the deadline.
          No money moves on its own while a rule or a person is reviewing the case.
        </p>
      </section>

      <BuyerAction
        deal={deal}
        checkoutEnabled={isSupabaseConfigured() && isPayPalConfigured()}
        releaseEnabled={isSupabaseConfigured()}
        paymentInProgress={paymentInProgress}
      />

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

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-rule-line pt-5 text-[0.8125rem] leading-[1.5] text-ink-muted">
        <span>Sandbox demo. No real money moves.</span>
        <Link
          href={`/seller/${deal.id}`}
          className="inline-flex h-11 items-center rounded-sm font-medium text-postal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-postal-ink"
        >
          Switch to the seller view
        </Link>
      </footer>
    </div>
  );
}

function PaymentNotice({ status }: { status: string | undefined }) {
  if (!status) return null;

  const copy: Record<
    string,
    { title: string; body: string; tone: "info" | "error" }
  > = {
    approved: {
      title: "PayPal approved the payment",
      body: "PayPal accepted the payment and we are waiting for its confirmation. The deal moves to funds held only after that confirmation arrives; nothing is released or paid out yet.",
      tone: "info",
    },
    processing: {
      title: "Waiting for PayPal",
      body: "PayPal has the payment and is still processing it. This page updates when the confirmation arrives; do not pay again.",
      tone: "info",
    },
    cancelled: {
      title: "Checkout cancelled",
      body: "You closed PayPal before approving the payment. Nothing moved.",
      tone: "info",
    },
    failed: {
      title: "The payment did not go through",
      body: "PayPal refused the capture. Nothing moved; you can try again.",
      tone: "error",
    },
    "not-configured": {
      title: "Payments are not configured here",
      body: "This environment has no PayPal sandbox credentials. Nothing can be charged.",
      tone: "error",
    },
    error: {
      title: "PayPal did not confirm a payment",
      body: "We could not capture the order. Nothing moved; try again or ask the seller for the Trust Link.",
      tone: "error",
    },
  };

  const entry = copy[status];
  if (!entry) return null;

  const error = entry.tone === "error";

  return (
    <section
      role={error ? "alert" : "status"}
      className={
        error
          ? "flex items-start gap-2 rounded-lg border border-blocked bg-blocked-wash p-4 text-blocked"
          : "space-y-1 rounded-lg border border-rule-line bg-kraft p-4"
      }
    >
      {error ? (
        <AlertCircle
          aria-hidden="true"
          size={16}
          strokeWidth={1.75}
          className="mt-0.5 shrink-0"
        />
      ) : null}
      <div className="space-y-1">
        <h2 className="text-[0.9375rem] font-semibold leading-[1.35]">
          {entry.title}
        </h2>
        <p
          className={`max-w-[65ch] text-[0.875rem] leading-[1.55] ${
            error ? "" : "text-ink"
          }`}
        >
          {entry.body}
        </p>
      </div>
    </section>
  );
}

function BuyerAction({
  deal,
  checkoutEnabled,
  releaseEnabled,
  paymentInProgress,
}: {
  deal: DealView;
  checkoutEnabled: boolean;
  releaseEnabled: boolean;
  paymentInProgress: boolean;
}) {
  if (deal.state === "AWAITING_PAYMENT") {
    return (
      <section aria-labelledby="buyer-action-heading" className="space-y-3">
        <h2
          id="buyer-action-heading"
          className="text-[1.125rem] font-semibold leading-[1.35] text-ink"
        >
          Your next step
        </h2>
        {paymentInProgress ? (
          <p className="max-w-[65ch] text-[0.9375rem] leading-[1.55] text-ink">
            {deal.seller.displayName} will see the funds as held after PayPal
            confirms the capture. Reload this page in a moment.
          </p>
        ) : checkoutEnabled ? (
          <StartCheckoutForm dealId={deal.id} amountCents={deal.priceCents} />
        ) : (
          <p className="max-w-[65ch] text-[0.9375rem] leading-[1.55] text-ink-muted">
            {deal.seller.displayName} is waiting for the payment of{" "}
            <span className="font-mono tabular-nums">
              {formatMoney(deal.priceCents)}
            </span>
            . Paying with PayPal needs Supabase and sandbox credentials in this
            environment; this preview cannot charge anything.
          </p>
        )}
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
          Your next step
        </h2>
        {releaseEnabled ? (
          <ConfirmReceiptForm dealId={deal.id} amountCents={deal.priceCents} />
        ) : (
          <p className="max-w-[65ch] text-[0.9375rem] leading-[1.55] text-ink-muted">
            Confirming receipt needs Supabase in this environment. The money stays
            held while the deal is unavailable.
          </p>
        )}
        <p className="max-w-[65ch] text-[0.875rem] leading-[1.55] text-ink-muted">
          If the deadline passes first, the payout is sent automatically to{" "}
          {deal.seller.displayName}.
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
          the mediator releases it to {deal.seller.displayName} or refunds you.
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
