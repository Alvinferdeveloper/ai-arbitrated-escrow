import type { DealOutcome } from "@/lib/deals/story";

/** How a deal ended, in place of the next step once the money moves. */
export function DealOutcomeSection({ outcome }: { outcome: DealOutcome }) {
  return (
    <section aria-labelledby="outcome-heading" className="space-y-2 rounded-lg border border-rule-line bg-kraft p-4">
      <h2 id="outcome-heading" className="text-[1.125rem] font-semibold leading-[1.35] text-ink">
        {outcome.title}
      </h2>
      <p className="max-w-[65ch] text-[0.9375rem] leading-[1.55] text-ink">{outcome.body}</p>
    </section>
  );
}
