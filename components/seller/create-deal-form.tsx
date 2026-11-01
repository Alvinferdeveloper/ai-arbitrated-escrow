"use client";

import { AlertCircle } from "lucide-react";
import { useActionState } from "react";
import { createDealAction, type CreateDealFormState } from "@/app/(dashboard)/seller/actions";
import { Button } from "@/components/ui/button";
import type { PartyOption } from "@/lib/db/deal-store";
import { MAX_DELIVERY_ESTIMATE_DAYS } from "@/lib/config";

const FIELD =
  "w-full rounded-md border border-rule-line bg-sheet text-[1rem] text-ink placeholder:text-ink-muted focus:outline-none focus:border-postal-ink focus:ring-2 focus:ring-postal-ink focus:ring-offset-2 focus:ring-offset-paper disabled:bg-kraft disabled:text-ink-muted aria-[invalid=true]:border-blocked aria-[invalid=true]:ring-blocked";
const INPUT = `h-12 px-3.5 ${FIELD}`;
const TEXTAREA = "min-h-24 px-3.5 py-3 leading-[1.55]";

const LABEL = "block text-[0.8125rem] font-medium text-ink-muted";
const FIELD_ERROR = "flex items-center gap-1.5 text-[0.8125rem] text-blocked";
const HINT = "text-[0.8125rem] text-ink-muted";

const initialFormState: CreateDealFormState = {
  status: "IDLE",
  message: null,
  fieldErrors: {},
};

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;

  return (
    <p id={id} className={FIELD_ERROR}>
      <AlertCircle aria-hidden="true" size={16} strokeWidth={1.75} />
      {message}
    </p>
  );
}

export function CreateDealForm({
  sellers,
  buyers,
}: {
  sellers: PartyOption[];
  buyers: PartyOption[];
}) {
  const [state, formAction, pending] = useActionState(
    createDealAction,
    initialFormState,
  );

  const invalid =
    state.status === "INVALID_INPUT" || state.status === "PARTY_NOT_FOUND";

  return (
    <form action={formAction} className="space-y-6">
      {invalid && state.message ? (
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
          <p className="text-[0.875rem] leading-[1.55]">{state.message}</p>
        </div>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="sellerId" className={LABEL}>
            Seller
          </label>
          <select
            id="sellerId"
            name="sellerId"
            defaultValue={sellers[0]?.id ?? ""}
            aria-invalid={Boolean(state.fieldErrors.sellerId)}
            aria-describedby="sellerId-error sellerId-hint"
            className={INPUT}
          >
            {sellers.map((option) => (
              <option key={option.id} value={option.id}>
                {option.displayName}
              </option>
            ))}
          </select>
          <FieldError
            id="sellerId-error"
            message={state.fieldErrors.sellerId}
          />
          <p id="sellerId-hint" className={HINT}>
            Who ships the item. Payouts go to their PayPal email.
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="buyerId" className={LABEL}>
            Buyer
          </label>
          <select
            id="buyerId"
            name="buyerId"
            defaultValue={buyers[0]?.id ?? ""}
            aria-invalid={Boolean(state.fieldErrors.buyerId)}
            aria-describedby="buyerId-error buyerId-hint"
            className={INPUT}
          >
            {buyers.map((option) => (
              <option key={option.id} value={option.id}>
                {option.displayName}
              </option>
            ))}
          </select>
          <FieldError id="buyerId-error" message={state.fieldErrors.buyerId} />
          <p id="buyerId-hint" className={HINT}>
            Who receives the Trust Link and pays.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="title" className={LABEL}>
          Title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          maxLength={140}
          placeholder="Sony WH-1000XM4 headphones"
          aria-invalid={Boolean(state.fieldErrors.title)}
          aria-describedby="title-error title-hint"
          className={INPUT}
        />
        <FieldError id="title-error" message={state.fieldErrors.title} />
        <p id="title-hint" className={HINT}>
          What the buyer is buying. It is shown on the Trust Link.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="description" className={LABEL}>
          Description
        </label>
        <textarea
          id="description"
          name="description"
          maxLength={2000}
          rows={4}
          placeholder="Condition, what is included, anything the buyer should know."
          aria-invalid={Boolean(state.fieldErrors.description)}
          aria-describedby="description-error description-hint"
          className={`${TEXTAREA} ${FIELD}`}
        />
        <FieldError
          id="description-error"
          message={state.fieldErrors.description}
        />
        <p id="description-hint" className={HINT}>
          The record the audit compares the photos against.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="priceUsd" className={LABEL}>
            Price
          </label>
          <div className="relative">
            <input
              id="priceUsd"
              name="priceUsd"
              type="text"
              inputMode="decimal"
              required
              placeholder="37.50"
              className={`${INPUT} font-mono pr-14 tabular-nums`}
              aria-invalid={Boolean(state.fieldErrors.priceUsd)}
              aria-describedby="priceUsd-error priceUsd-hint"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-[0.875rem] text-ink-muted"
            >
              USD
            </span>
          </div>
          <FieldError
            id="priceUsd-error"
            message={state.fieldErrors.priceUsd}
          />
          <p id="priceUsd-hint" className={HINT}>
            In USD. Larger deals get a person&apos;s review before shipping.
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="deliveryEstimateDays" className={LABEL}>
            Delivery estimate
          </label>
          <select
            id="deliveryEstimateDays"
            name="deliveryEstimateDays"
            defaultValue="3"
            aria-invalid={Boolean(state.fieldErrors.deliveryEstimateDays)}
            aria-describedby="deliveryEstimateDays-error deliveryEstimateDays-hint"
            className={INPUT}
          >
            {Array.from(
              { length: MAX_DELIVERY_ESTIMATE_DAYS },
              (_, index) => index + 1,
            ).map((days) => (
              <option key={days} value={String(days)}>
                {days} {days === 1 ? "day" : "days"}
              </option>
            ))}
          </select>
          <FieldError
            id="deliveryEstimateDays-error"
            message={state.fieldErrors.deliveryEstimateDays}
          />
          <p id="deliveryEstimateDays-hint" className={HINT}>
            Auto-release runs 48 hours after this estimate.
          </p>
        </div>
      </div>

      {state.status === "NOT_CONFIGURED" || state.status === "FAILED" ? (
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
          <p className="text-[0.875rem] leading-[1.55]">{state.message}</p>
        </div>
      ) : null}

      <div className="border-t border-rule-line pt-6">
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? "Creating the deal" : "Create the deal"}
        </Button>
        <p className="mt-3 max-w-[65ch] text-[0.8125rem] leading-[1.5] text-ink-muted">
          The buyer pays after you share the Trust Link. Creating the deal
          charges nobody.
        </p>
      </div>
    </form>
  );
}
