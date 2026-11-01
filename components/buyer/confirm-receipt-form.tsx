"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  confirmReceiptAction,
  type ConfirmReceiptState,
} from "@/app/(public)/t/[id]/actions";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/deals/money";

const initialState: ConfirmReceiptState = { status: "IDLE", message: null };

function ConfirmButton({
  amountCents,
  disabled,
}: {
  amountCents: number;
  disabled: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={pending || disabled}
      className="w-full sm:w-auto"
    >
      {pending
        ? "Sending the payout"
        : `Confirm receipt of ${formatMoney(amountCents)}`}
    </Button>
  );
}

export function ConfirmReceiptForm({
  dealId,
  amountCents,
}: {
  dealId: string;
  amountCents: number;
}) {
  const [state, formAction] = useActionState(
    confirmReceiptAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="dealId" value={dealId} />
      <ConfirmButton amountCents={amountCents} disabled={state.status === "QUEUED"} />

      {state.message ? (
        <div
          role={state.status === "FAILED" ? "alert" : "status"}
          className={
            state.status === "FAILED"
              ? "flex items-start gap-2 rounded-md border border-blocked bg-blocked-wash p-3 text-blocked"
              : "flex items-start gap-2 rounded-md border border-rule-line bg-kraft p-3 text-ink"
          }
        >
          {state.status === "FAILED" ? (
            <AlertCircle
              aria-hidden="true"
              size={16}
              strokeWidth={1.75}
              className="mt-0.5 shrink-0"
            />
          ) : (
            <CheckCircle2
              aria-hidden="true"
              size={16}
              strokeWidth={1.75}
              className="mt-0.5 shrink-0"
            />
          )}
          <p className="text-[0.875rem] leading-[1.55]">{state.message}</p>
        </div>
      ) : null}

      <p className="max-w-[65ch] text-[0.875rem] leading-[1.55] text-ink-muted">
        Only confirm after the parcel arrives as described. This sends the held
        money to the seller; PayPal&apos;s confirmation is what marks the deal
        released.
      </p>
    </form>
  );
}
