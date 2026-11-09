import { formatMoney } from "@/lib/deals/money";
import {
  confirmingPaymentNextAction,
  nextActionFor,
  type SlipAudience,
} from "@/lib/state-machine/presentation";
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
  audience,
  confirmingPayment = false,
}: {
  amountCents: number;
  state: DealState;
  deadline?: string;
  /** Addresses the reader as "you"; omitted on neutral previews. */
  audience?: SlipAudience;
  /** PayPal has the payment and has not confirmed it yet. */
  confirmingPayment?: boolean;
}) {

  return (
    <section
      aria-label="Holding slip"
      className="rounded-lg border border-rule-line bg-sheet p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <p className="text-[0.8125rem] font-medium text-ink-muted">{confirmingPayment ? "Amount paid" : amountLabel(state)}</p>
          <p className="mt-1 font-mono text-[2rem] font-medium leading-[1.1] tracking-[-0.02em] tabular-nums text-ink">
            {formatMoney(amountCents)}
          </p>
        </div>
        <StateStamp
          state={state}
          confirmingPayment={confirmingPayment}
          className="self-start sm:self-auto"
        />
      </div>
      <div className="mt-5 border-t border-dashed border-rule-line pt-4">
        <p className="max-w-[65ch] text-[0.9375rem] leading-[1.55] text-ink">
          {confirmingPayment && audience
            ? confirmingPaymentNextAction(audience)
            : nextActionFor(state, audience)}
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
