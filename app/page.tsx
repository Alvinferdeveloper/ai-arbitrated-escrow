import { Suspense } from "react";
import { connection } from "next/server";
import { ArrowUpRight } from "lucide-react";
import { AppBar } from "@/components/app-bar";
import { HeldBetween } from "@/components/held-between";
import { StateStamp } from "@/components/state-stamp";
import { ButtonLink } from "@/components/ui/button";
import { DEMO_DEALS } from "@/demo/data";
import { APP_NAME, DEMO_MODE } from "@/lib/config";
import { getDealStates } from "@/lib/db/deal-store";
import { isSupabaseConfigured } from "@/lib/db/server";
import { formatMoney } from "@/lib/deals/money";
import type { DealState } from "@/lib/state-machine/states";

const SCENARIO_COPY = [
  "The photos match the listing, so the AI clears the deal to ship. The seller is paid once the buyer confirms receipt or the deadline passes.",
  "The shipping label says 0.4 kg, too light for this product. The AI asks the seller for a new photo.",
  "The buyer reports a problem. The AI compares both sides' photos, they contradict each other, so a person decides.",
];

const STEPS = [
  {
    title: "The seller creates a deal",
    body: "A title and a price, typed or read from a screenshot of the listing. The seller gets a Trust Link: the page the buyer opens to pay.",
    tryIt: "Press Try a sample deal, then create it.",
  },
  {
    title: "The buyer pays with PayPal",
    body: "The money waits with us. The seller cannot touch it yet.",
    tryIt: "Open the Trust Link and pay with the sandbox buyer shown there.",
  },
  {
    title: "The seller proves the parcel",
    body: "Three photos: the item, the item in its box, and the sealed parcel with its shipping label. In about 20 seconds the AI clears the deal to ship, asks for a new photo, or refunds the buyer.",
    tryIt: "Switch to the seller view and send the photos, or a sample set if one is listed.",
  },
  {
    title: "The money moves last",
    body: "The seller is paid on receipt or after the deadline. If the buyer reports a problem, the AI compares both sides, and only a real contradiction goes to a person.",
    tryIt: "On a shipped deal, report a problem as the buyer.",
  },
];

export default function Home() {
  return (
    <div className="min-h-[100dvh] bg-paper">
      <AppBar />
      <main className="mx-auto w-full max-w-[640px] px-4 pb-20 pt-10 md:px-6 md:pt-14">
        <p className="text-[0.8125rem] font-medium text-ink-muted">
          Sandbox demo. No real money moves.
        </p>
        <h1 className="mt-3 max-w-[18ch] text-[2.5rem] font-semibold leading-[1.05] tracking-[-0.03em] text-ink">
          Two strangers. One sale. Neither trusts the other.
        </h1>
        <p className="mt-4 max-w-[65ch] text-[1.0625rem] leading-[1.55] text-ink">
          The buyer fears paying for an empty box. The seller fears shipping and being told
          the box arrived empty. {APP_NAME} sits between them: the buyer pays with PayPal, we
          hold the money, and nothing ships until an AI clears the parcel photos.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {DEMO_MODE ? (
            <ButtonLink href="/seller?sample=1">Try a sample deal</ButtonLink>
          ) : (
            <ButtonLink href="/seller">Create a deal</ButtonLink>
          )}
          <ButtonLink href="#examples" variant="ghost">
            See what the AI decides
          </ButtonLink>
        </div>

        <div className="mt-10">
          <HeldBetween amountCents={DEMO_DEALS[0].priceCents} />
        </div>

        <section id="examples" aria-labelledby="examples-heading" className="mt-14 scroll-mt-20">
          <div className="flex items-baseline justify-between gap-4">
            <h2
              id="examples-heading"
              className="text-[1.125rem] font-semibold leading-[1.35] text-ink"
            >
              What the AI decides
            </h2>
            <span className="text-[0.8125rem] text-ink-muted">Example deals</span>
          </div>
          <p className="mt-2 max-w-[65ch] text-[1rem] leading-[1.55] text-ink">
            Reviewing a dispute by hand costs more than the sale, so today nobody does. Here
            the AI reads the evidence and explicit rules decide.
          </p>
          <Suspense fallback={<DemoDealList />}>
            <LiveDemoDealList />
          </Suspense>
        </section>

        <section aria-labelledby="how-heading" className="mt-14">
          <h2
            id="how-heading"
            className="text-[1.125rem] font-semibold leading-[1.35] text-ink"
          >
            How it works
          </h2>
          {DEMO_MODE ? (
            <p className="mt-2 max-w-[65ch] text-[0.9375rem] leading-[1.55] text-ink-muted">
              No sign-up. You play every role, and the AI checks every photo for real.
            </p>
          ) : null}
          <ol className="mt-4 space-y-5">
            {STEPS.map((step, index) => (
              <li key={step.title} className="grid grid-cols-[2rem_1fr] gap-3">
                <span
                  aria-hidden="true"
                  className="font-mono text-[0.875rem] tabular-nums text-ink-muted"
                >
                  0{index + 1}
                </span>
                <div>
                  <p className="text-[0.9375rem] font-medium text-ink">{step.title}</p>
                  <p className="mt-1 max-w-[65ch] text-[0.875rem] leading-[1.55] text-ink-muted">
                    {step.body}
                  </p>
                  {DEMO_MODE ? (
                    <p className="mt-1 max-w-[65ch] text-[0.875rem] leading-[1.55] text-ink">
                      <span className="font-medium">Try it:</span> {step.tryIt}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
          {DEMO_MODE ? (
            <div className="mt-6">
              <ButtonLink href="/seller?sample=1">Try a sample deal</ButtonLink>
            </div>
          ) : null}
        </section>

        <footer className="mt-14 border-t border-rule-line pt-5 text-[0.8125rem] leading-[1.5] text-ink-muted">
          Sandbox demo. No real money moves.
        </footer>
      </main>
    </div>
  );
}

// Falls back to the seeded states when the database is unavailable.
function DemoDealList({ states }: { states?: Map<string, DealState> }) {
  return (
    <ul className="mt-4 divide-y divide-rule-line border-y border-rule-line">
      {DEMO_DEALS.map((deal, index) => (
        <li key={deal.id}>
          <a
            href={`/t/${deal.id}`}
            className="group flex items-start gap-4 py-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-postal-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[0.875rem] tabular-nums text-ink-muted">
                  {formatMoney(deal.priceCents)}
                </span>
                <StateStamp state={states?.get(deal.id) ?? deal.state} />
              </div>
              <p className="mt-1 text-[0.9375rem] font-medium text-ink">
                {deal.title}
              </p>
              <p className="mt-1 max-w-[65ch] text-[0.875rem] leading-[1.55] text-ink-muted">
                {SCENARIO_COPY[index]}
              </p>
            </div>
            <ArrowUpRight
              aria-hidden="true"
              size={20}
              strokeWidth={1.75}
              className="mt-1 shrink-0 text-ink-muted transition-transform duration-150 ease-out-quart group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-postal-ink"
            />
          </a>
        </li>
      ))}
    </ul>
  );
}

async function LiveDemoDealList() {
  if (!isSupabaseConfigured()) return <DemoDealList />;
  await connection();

  let states: Map<string, DealState> | undefined;
  try {
    states = await getDealStates(DEMO_DEALS.map((deal) => deal.id));
  } catch (error) {
    console.error("Could not load the demo deal states", error);
  }

  return <DemoDealList states={states} />;
}
