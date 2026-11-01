import { ArrowUpRight } from "lucide-react";
import { AppBar } from "@/components/app-bar";
import { HoldingSlip } from "@/components/holding-slip";
import { StateStamp } from "@/components/state-stamp";
import { ButtonLink } from "@/components/ui/button";
import { DEMO_DEALS } from "@/demo/data";
import { formatMoney } from "@/lib/deals/money";

const SCENARIO_COPY = [
  "The evidence passes, tracking is attached, and the money releases after receipt or the deadline.",
  "The guide says 0.4 kg. That is too light for the product, so shipping is blocked.",
  "The buyer's unboxing photo conflicts with the sealed parcel. A mediator decides.",
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
    body: "On receipt or after the deadline, the seller is paid. A dispute goes through arbitration, and a person decides the doubtful cases.",
  },
];

export default function Home() {
  const firstDeal = DEMO_DEALS[0];

  return (
    <div className="min-h-[100dvh] bg-paper">
      <AppBar right="Sandbox" />
      <main className="mx-auto w-full max-w-[640px] px-4 pb-20 pt-10 md:px-6 md:pt-14">
        <p className="text-[0.8125rem] font-medium text-ink-muted">
          Escrow for peer-to-peer sales
        </p>
        <h1 className="mt-3 max-w-[18ch] text-[2.5rem] font-semibold leading-[1.05] tracking-[-0.03em] text-ink">
          Money held until the parcel is checked.
        </h1>
        <p className="mt-4 max-w-[65ch] text-[1.0625rem] leading-[1.55] text-ink">
          We hold the buyer&apos;s payment, audit the seller&apos;s photos and shipping guide, and
          release the money when the parcel arrives. If a rule fires, a person decides.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href={`/t/${firstDeal.id}`}>Open the buyer view</ButtonLink>
          <ButtonLink href="/seller" variant="secondary">
            Open the seller view
          </ButtonLink>
          <ButtonLink href="#how-it-works" variant="ghost">
            Read how it works
          </ButtonLink>
        </div>

        <div className="mt-10 space-y-3">
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
                      <StateStamp state={deal.state} />
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
