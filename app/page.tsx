import { Suspense } from "react";
import { connection } from "next/server";
import { ArrowUpRight } from "lucide-react";
import { AppBar } from "@/components/app-bar";
import { HoldingSlip } from "@/components/holding-slip";
import { StateStamp } from "@/components/state-stamp";
import { ButtonLink } from "@/components/ui/button";
import { DEMO_DEALS } from "@/demo/data";
import { APP_NAME, DEMO_MODE } from "@/lib/config";
import { getDealStates } from "@/lib/db/deal-store";
import { isSupabaseConfigured } from "@/lib/db/server";
import { formatMoney } from "@/lib/deals/money";
import type { DealState } from "@/lib/state-machine/states";

const SCENARIO_COPY = [
  "The evidence passes, tracking is attached, and the money releases after receipt or the deadline.",
  "The guide says 0.4 kg. That is too light for the product, so the AI asks for a new guide photo.",
  "The buyer disputes the delivery. The AI compares both sides' photos, they contradict each other, so a mediator decides.",
];

const FEARS = [
  {
    who: "The buyer",
    fear: "pays first and gets an empty box, a brick, or nothing at all.",
  },
  {
    who: "The seller",
    fear: "ships first and faces a buyer who swears the parcel arrived empty.",
  },
];

const TRY_IT = [
  {
    title: "Create a deal as the seller",
    body: "Open Create a deal, press Use the sample listing, then create it.",
  },
  {
    title: "Pay as the buyer",
    body: "Open the Trust Link and pay with PayPal, using the sandbox buyer shown on the page.",
  },
  {
    title: "Send the evidence",
    body: "Switch to the seller view, load a sample evidence set and send it for audit.",
  },
  {
    title: "Watch the AI decide",
    body: "In about 20 seconds it ships the deal, asks for a specific retake, or refunds the buyer. Try each sample set.",
  },
  {
    title: "Optional: dispute as the buyer",
    body: "On a shipped deal, report a problem with a sample unboxing photo and see the AI arbitrate.",
  },
];

const STEPS = [
  {
    title: "The seller creates a deal",
    body: "A title, a price and a description. Then a Trust Link to share with the buyer.",
  },
  {
    title: "The buyer pays",
    body: "Checkout captures the payment into the platform account. We hold it until the deal ends.",
  },
  {
    title: "The seller proves the parcel",
    body: "Photos A, B and C plus the shipping guide. A vision model reads them and explicit rules decide whether shipping can start.",
  },
  {
    title: "The money moves last",
    body: "On receipt or after the deadline, the seller is paid. In a dispute the AI compares both sides; only evidence that contradicts itself goes to a person.",
  },
];

export default function Home() {
  const firstDeal = DEMO_DEALS[0];

  return (
    <div className="min-h-[100dvh] bg-paper">
      <AppBar right="Sandbox" />
      <main className="mx-auto w-full max-w-[640px] px-4 pb-20 pt-10 md:px-6 md:pt-14">
        <p className="text-[0.8125rem] font-medium text-ink-muted">
          Escrow for sales between strangers online
        </p>
        <h1 className="mt-3 max-w-[18ch] text-[2.5rem] font-semibold leading-[1.05] tracking-[-0.03em] text-ink">
          Money held until the parcel is checked.
        </h1>
        <p className="mt-4 max-w-[65ch] text-[1.0625rem] leading-[1.55] text-ink">
          We hold the buyer&apos;s payment, audit the seller&apos;s photos and shipping guide, and
          release the money when the parcel arrives. The AI ships, asks for new photos or refunds on
          its own; a person only sees evidence that contradicts itself.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/seller">Create a deal</ButtonLink>
          <ButtonLink href="/deals" variant="secondary">
            See all deals
          </ButtonLink>
          <ButtonLink href="#how-it-works" variant="ghost">
            Read how it works
          </ButtonLink>
        </div>

        <section aria-labelledby="problem-heading" className="mt-14">
          <h2
            id="problem-heading"
            className="text-[1.125rem] font-semibold leading-[1.35] text-ink"
          >
            The problem
          </h2>
          <p className="mt-2 max-w-[65ch] text-[1rem] leading-[1.55] text-ink">
            Buying from a stranger online still has no safety net. Stores have return
            policies and buyer protection; a sale between two people over chat has none
            of that.
          </p>
          <dl className="mt-4 grid border-y border-rule-line sm:grid-cols-2 sm:divide-x sm:divide-rule-line">
            {FEARS.map((item, index) => (
              <div
                key={item.who}
                className={`py-4 sm:px-4 sm:first:pl-0 sm:last:pr-0 ${
                  index > 0 ? "border-t border-rule-line sm:border-t-0" : ""
                }`}
              >
                <dt className="text-[0.9375rem] font-medium text-ink">{item.who}</dt>
                <dd className="mt-1 text-[0.9375rem] leading-[1.55] text-ink-muted">
                  {item.fear}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 max-w-[65ch] text-[1rem] leading-[1.55] text-ink">
            Nobody checks who is telling the truth, because reviewing a dispute by hand
            costs more than the sale. So the honest side loses, or people simply
            don&apos;t buy.
          </p>
          <p className="mt-3 max-w-[65ch] text-[1rem] leading-[1.55] text-ink">
            <span className="font-medium">{APP_NAME} is the missing safety net:</span> it
            holds the money, checks the parcel photos before shipping, compares them again
            if the buyer disputes, and hands a person only the cases where the two sides
            contradict each other.
          </p>
        </section>

        {DEMO_MODE ? (
          <section aria-labelledby="try-heading" className="mt-14">
            <h2
              id="try-heading"
              className="text-[1.125rem] font-semibold leading-[1.35] text-ink"
            >
              Try it in three minutes
            </h2>
            <p className="mt-2 max-w-[65ch] text-[0.9375rem] leading-[1.55] text-ink-muted">
              No sign-up and no photos to take. You play every role, and the AI checks
              every photo for real.
            </p>
            <ol className="mt-4 space-y-4 border-l border-rule-line pl-4">
              {TRY_IT.map((step, index) => (
                <li key={step.title}>
                  <p className="text-[0.9375rem] font-medium text-ink">
                    <span className="mr-2 font-mono tabular-nums text-ink-muted">{index + 1}.</span>
                    {step.title}
                  </p>
                  <p className="mt-1 max-w-[65ch] text-[0.875rem] leading-[1.55] text-ink-muted">
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>
            <div className="mt-5">
              <ButtonLink href="/seller">Start with a sample deal</ButtonLink>
            </div>
          </section>
        ) : null}

        <div className="mt-14 space-y-3">
          <p className="text-[0.8125rem] font-medium text-ink-muted">
            What the buyer sees
          </p>
          <HoldingSlip
            amountCents={firstDeal.priceCents}
            state={firstDeal.state}
            deadline="Auto-release in 1d 22h"
          />
        </div>

        <section id="demo" aria-labelledby="demo-heading" className="mt-14">
          <div className="flex items-baseline justify-between gap-4">
            <h2
              id="demo-heading"
              className="text-[1.125rem] font-semibold leading-[1.35] text-ink"
            >
              Walk the demo
            </h2>
            <span className="text-[0.8125rem] text-ink-muted">3 seeded deals</span>
          </div>
          <Suspense fallback={<DemoDealList />}>
            <LiveDemoDealList />
          </Suspense>
          <div className="mt-4 flex justify-end">
            <ButtonLink href="/mediator" variant="ghost" size="sm">
              Open the mediator queue
            </ButtonLink>
          </div>
        </section>

        <section id="how-it-works" aria-labelledby="how-heading" className="mt-14">
          <h2
            id="how-heading"
            className="text-[1.125rem] font-semibold leading-[1.35] text-ink"
          >
            How it works
          </h2>
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
                </div>
              </li>
            ))}
          </ol>
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
