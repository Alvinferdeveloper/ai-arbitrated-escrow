import { formatMoney } from "@/lib/deals/money";
import { STATE_PRESENTATION } from "@/lib/state-machine/presentation";
import type { DealState } from "@/lib/state-machine/states";
import { StateStamp } from "./state-stamp";

function amountLabel(state: DealState): string {
  if (state === "AWAITING_PAYMENT") return "Amount due";
  if (state === "RELEASED" || state === "REFUNDED") return "Amount settled";
  return "Held amount";
}

export function HoldingSlip({
  amountCents,
  state,
  deadline,
}: {
  amountCents: number;
  state: DealState;
  deadline?: string;
}) {
  const presentation = STATE_PRESENTATION[state];

  return (
    <section
      aria-label="Holding slip"
      className="rounded-lg border border-rule-line bg-sheet p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <p className="text-[0.8125rem] font-medium text-ink-muted">{amountLabel(state)}</p>
          <p className="mt-1 font-mono text-[2rem] font-medium leading-[1.1] tracking-[-0.02em] tabular-nums text-ink">
            {formatMoney(amountCents)}
          </p>
        </div>
        <StateStamp state={state} className="self-start sm:self-auto" />
      </div>
      <div className="mt-5 border-t border-dashed border-rule-line pt-4">
        <p className="max-w-[65ch] text-[0.9375rem] leading-[1.55] text-ink">
          {presentation.nextAction}
        </p>
        {deadline ? (
          <p className="mt-2 font-mono text-[0.875rem] tabular-nums text-ink-muted">
            {deadline}
          </p>
        ) : null}
      </div>
    </section>
  );
}
