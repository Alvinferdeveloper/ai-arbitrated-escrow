"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  confirmReceiptAction,
  type ConfirmReceiptState,
} from "@/app/(public)/t/[id]/actions";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/deals/money";

const initialState: ConfirmReceiptState = { status: "IDLE", message: null };

function ReleaseButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending || disabled} className="w-full sm:w-auto">
      {pending ? "Sending the payout" : "Yes, release the money"}
    </Button>
  );
}

function CancelButton({ onCancel }: { onCancel: () => void }) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="button"
      variant="secondary"
      disabled={pending}
      onClick={onCancel}
      className="w-full sm:w-auto"
    >
      Not yet
    </Button>
  );
}

/** Releasing the money cannot be undone, so the button asks once more in place. */
export function ConfirmReceiptForm({
  dealId,
  amountCents,
  sellerName,
}: {
  dealId: string;
  amountCents: number;
  sellerName: string;
}) {
  const [state, formAction] = useActionState(confirmReceiptAction, initialState);
  const [confirming, setConfirming] = useState(false);
  const amount = formatMoney(amountCents);
  const queued = state.status === "QUEUED";

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="dealId" value={dealId} />

      {confirming && !queued ? (
        <div className="space-y-3 rounded-lg border border-rule-line bg-kraft p-4">
          <p className="text-[0.9375rem] font-medium text-ink">
            Release {amount} to {sellerName}?
          </p>
          <p className="max-w-[65ch] text-[0.875rem] leading-[1.55] text-ink">
            Only if the parcel arrived as described. This ends your protection and cannot be
            undone.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <ReleaseButton disabled={queued} />
            <CancelButton onCancel={() => setConfirming(false)} />
          </div>
        </div>
      ) : (
        <Button
          type="button"
          disabled={queued}
          onClick={() => setConfirming(true)}
          className="w-full sm:w-auto"
        >
          Confirm receipt of {amount}
        </Button>
      )}

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
            <AlertCircle aria-hidden="true" size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
          ) : (
            <CheckCircle2 aria-hidden="true" size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
          )}
          <p className="text-[0.875rem] leading-[1.55]">{state.message}</p>
        </div>
      ) : null}

      {confirming ? null : (
        <p className="max-w-[65ch] text-[0.875rem] leading-[1.55] text-ink-muted">
          Only confirm after the parcel arrives as described. This sends the held money to the
          seller.
        </p>
      )}
    </form>
  );
}
