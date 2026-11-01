"use client";

import { AlertCircle } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  startCheckoutAction,
  type StartCheckoutState,
} from "@/app/(public)/t/[id]/actions";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/deals/money";

const initialState: StartCheckoutState = { error: null };

function PayButton({ amountCents }: { amountCents: number }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending
        ? "Opening PayPal"
        : `Pay ${formatMoney(amountCents)} with PayPal`}
    </Button>
  );
}

export function StartCheckoutForm({
  dealId,
  amountCents,
}: {
  dealId: string;
  amountCents: number;
}) {
  const [state, formAction] = useActionState(startCheckoutAction, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="dealId" value={dealId} />
      <PayButton amountCents={amountCents} />

      {state.error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-blocked bg-blocked-wash p-3 text-blocked"
        >
          <AlertCircle
            aria-hidden="true"
            size={16}
            strokeWidth={1.75}
            className="mt-0.5 shrink-0"
          />
          <p className="text-[0.875rem] leading-[1.55]">{state.error}</p>
        </div>
      ) : null}

      <p className="max-w-[65ch] text-[0.875rem] leading-[1.55] text-ink-muted">
        You approve the payment on PayPal. The money stays held until the parcel
        arrives or a dispute is decided; no payout happens because a photo was
        uploaded.
      </p>
    </form>
  );
}
