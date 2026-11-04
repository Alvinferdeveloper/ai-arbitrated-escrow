import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { AlertCircle, BookOpen } from "lucide-react";
import { AppBar } from "@/components/app-bar";
import { dealRoleHref, rolesFor } from "@/components/role-switcher";
import { StateStamp } from "@/components/state-stamp";
import { ButtonLink } from "@/components/ui/button";
import { getDemoDeals } from "@/demo/data";
import { listDeals } from "@/lib/db/deal-store";
import { isSupabaseConfigured } from "@/lib/db/server";
import { formatMoney } from "@/lib/deals/money";
import type { DealSummary } from "@/lib/deals/types";
import { formatCaseAge } from "@/lib/mediation/age";

export default function DealsPage() {
  return (
    <div className="min-h-[100dvh] bg-paper">
      <AppBar right="All deals" />
      <main className="mx-auto w-full max-w-[640px] px-4 pb-20 pt-6 md:px-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-[1.5rem] font-semibold leading-[1.2] tracking-[-0.015em] text-ink">
              Deals
            </h1>
            <p className="mt-2 max-w-[65ch] text-[1rem] leading-[1.55] text-ink">
              Every deal in this sandbox. Open one as the buyer, the seller or the
              mediator.
            </p>
          </div>
          <ButtonLink href="/seller" className="shrink-0">
            Create a deal
          </ButtonLink>
        </header>

        <div className="mt-8">
          <Suspense fallback={<DealsSkeleton />}>
            <DealsList />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

async function DealsList() {
  await connection();

  let deals: DealSummary[];
  try {
    deals = isSupabaseConfigured()
      ? await listDeals()
      : getDemoDeals().map((deal) => ({ ...deal, updatedAt: deal.createdAt }));
  } catch (error) {
    console.error("Could not load the deals", error);
    return <DealsLoadError />;
  }

  if (deals.length === 0) {
    return (
      <section className="space-y-3 rounded-lg border border-rule-line bg-kraft p-6">
        <h2 className="text-[1.125rem] font-semibold leading-[1.35] text-ink">No deals yet</h2>
        <p className="max-w-[65ch] text-[0.9375rem] leading-[1.55] text-ink">
          Create the first one. You get a Trust Link to open as the buyer.
        </p>
        <ButtonLink href="/seller" variant="secondary">
          Create a deal
        </ButtonLink>
      </section>
    );
  }

  const now = new Date();
  const real = deals.filter((deal) => !deal.isExample);
  const examples = deals.filter((deal) => deal.isExample);

  return (
    <div className="space-y-10">
      {real.length > 0 ? <DealRows deals={real} now={now} /> : null}
      {examples.length > 0 ? (
        <section aria-labelledby="examples-heading" className="space-y-3">
          <div>
            <h2 id="examples-heading" className="text-[1.125rem] font-semibold leading-[1.35] text-ink">
              Example deals
            </h2>
            <p className="mt-1 max-w-[65ch] text-[0.9375rem] leading-[1.55] text-ink-muted">
              Read-only snapshots, each frozen at one step to show its screens. Nothing in
              them moves; create a deal to run the real flow.
            </p>
          </div>
          <DealRows deals={examples} now={now} />
        </section>
      ) : null}
    </div>
  );
}

function ExampleTag() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-sm border border-rule-line bg-kraft px-2 py-1 text-[0.8125rem] font-medium leading-none text-ink">
      <BookOpen aria-hidden="true" size={16} strokeWidth={1.75} />
      Example
    </span>
  );
}

function DealRows({ deals, now }: { deals: DealSummary[]; now: Date }) {
  return (
    <ul className="divide-y divide-rule-line border-y border-rule-line">
      {deals.map((deal) => (
        <li key={deal.id} className="space-y-3 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[0.875rem] tabular-nums text-ink">
              {formatMoney(deal.priceCents)}
            </span>
            <StateStamp state={deal.state} />
            {deal.isExample ? <ExampleTag /> : null}
            {deal.isExample ? null : (
              <span className="ml-auto font-mono text-[0.8125rem] tabular-nums text-ink-muted">
                {formatCaseAge(deal.updatedAt, now)}
              </span>
            )}
          </div>
          <div>
            <p className="text-[0.9375rem] font-medium text-ink">{deal.title}</p>
            <p className="mt-0.5 text-[0.875rem] text-ink-muted">
              {deal.seller.displayName} to {deal.buyer.displayName}
            </p>
          </div>
          <div className="flex flex-wrap gap-x-5">
            {rolesFor(deal.state).map((role) => (
              <Link
                key={role}
                href={dealRoleHref(role, deal.id, deal.state)}
                className="inline-flex h-11 items-center rounded-sm text-[0.875rem] font-medium text-postal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-postal-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
              >
                {role === "buyer" ? "Buyer view" : role === "seller" ? "Seller view" : "Mediator"}
              </Link>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

function DealsSkeleton() {
  return (
    <div role="status" aria-live="polite" className="divide-y divide-rule-line border-y border-rule-line">
      <span className="sr-only">Loading the deals</span>
      {[0, 1, 2, 3].map((item) => (
        <div key={item} aria-hidden="true" className="space-y-3 py-4">
          <div className="h-6 w-48 rounded-sm bg-kraft" />
          <div className="h-4 w-2/3 rounded-sm bg-kraft" />
          <div className="h-4 w-1/2 rounded-sm bg-kraft" />
        </div>
      ))}
    </div>
  );
}

function DealsLoadError() {
  return (
    <section role="alert" className="space-y-2 rounded-lg border border-blocked bg-blocked-wash p-4">
      <div className="flex items-center gap-2 text-blocked">
        <AlertCircle aria-hidden="true" size={16} strokeWidth={1.75} />
        <h2 className="text-[1.125rem] font-semibold leading-[1.35]">
          The deals could not be loaded
        </h2>
      </div>
      <p className="max-w-[65ch] text-[0.9375rem] leading-[1.55] text-ink">
        The database answered with an error. Reload in a moment.
      </p>
    </section>
  );
}
