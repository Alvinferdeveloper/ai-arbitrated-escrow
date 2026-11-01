"use client";

import Link from "next/link";
import { LockKeyhole, TriangleAlert } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/deals/money";
import { describeMediationDecision } from "@/lib/mediation/decision";
import type {
  EvidenceTarget,
  MediationDecision,
  MediationSettlementView,
} from "@/lib/mediation/types";
import { decideMediationCase } from "@/app/(dashboard)/mediator/[id]/actions";

export function MediatorActions({
  caseId,
  amountCents,
  sellerName,
  buyerName,
  settlement,
  canApproveShipping,
}: {
  caseId: string;
  amountCents: number;
  sellerName: string;
  buyerName: string;
  settlement: MediationSettlementView | null;
  canApproveShipping: boolean;
}) {
  const busy = useRef(false);
  const [pending, setPending] = useState<MediationDecision | null>(null);
  const [target, setTarget] = useState<EvidenceTarget>("SELLER");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(decision: MediationDecision) {
    if (busy.current) return;
    busy.current = true;
    setSubmitting(true);
    setError(null);

    try {
      const response = await decideMediationCase({
        caseId,
        ...decision,
      });

      if (!response.ok) {
        setPending(null);
        setError(response.message);
        return;
      }

      setPending(null);
      setResult(
        describeMediationDecision(decision, {
          amountCents,
          sellerName,
          buyerName,
        }),
      );
    } catch {
      setPending(null);
      setError("The decision could not be sent. Nothing moved; try again.");
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  }

  function cancel() {
    if (submitting) return;
    setPending(null);
  }

  return (
    <section aria-labelledby="decision-heading" className="space-y-4">
      <div>
        <h2
          id="decision-heading"
          className="text-[1.125rem] font-semibold leading-[1.35] text-ink"
        >
          Decision
        </h2>
        <p className="mt-1 max-w-[65ch] text-[0.9375rem] leading-[1.55] text-ink-muted">
          A decision starts a guarded state change. A release or refund is only
          queued here; the deal settles when PayPal confirms the money moved.
        </p>
      </div>

      {result ? (
        <div
          role="status"
          aria-live="polite"
          className="rounded-md border border-rule-line bg-postal-ink-wash p-4"
        >
          <div className="flex gap-3">
            <LockKeyhole
              aria-hidden="true"
              size={18}
              strokeWidth={1.75}
              className="mt-0.5 shrink-0 text-postal-ink"
            />
            <p className="text-[0.9375rem] leading-[1.55] text-ink">{result}</p>
          </div>
          <Link
            href="/mediator"
            className="mt-3 inline-flex h-11 items-center rounded-sm text-[0.875rem] font-medium text-postal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-postal-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
          >
            Back to the queue
          </Link>
        </div>
      ) : error ? (
        <div
          role="alert"
          className="rounded-md border border-blocked bg-blocked-wash p-4"
        >
          <div className="flex gap-3">
            <TriangleAlert
              aria-hidden="true"
              size={18}
              strokeWidth={1.75}
              className="mt-0.5 shrink-0 text-blocked"
            />
            <div>
              <p className="text-[0.9375rem] leading-[1.55] text-ink">{error}</p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={() => setError(null)}
              >
                Try again
              </Button>
            </div>
          </div>
        </div>
      ) : settlement ? (
        <div
          role="status"
          className="rounded-md border border-rule-line bg-postal-ink-wash p-4"
        >
          <div className="flex gap-3">
            <LockKeyhole
              aria-hidden="true"
              size={18}
              strokeWidth={1.75}
              className="mt-0.5 shrink-0 text-postal-ink"
            />
            <div>
              <p className="text-[0.9375rem] leading-[1.55] text-ink">
                {settlement.status === "COMPLETED" ||
                settlement.status === "REFUNDED"
                  ? `PayPal confirmed the ${settlement.purpose === "PAYOUT" ? "payout" : "refund"}. The webhook is finishing the case.`
                  : `A ${settlement.purpose === "PAYOUT" ? "payout to the seller" : "refund to the buyer"} is queued. The deal stays with a mediator until PayPal confirms it.`}
              </p>
              <p className="mt-1 text-[0.8125rem] text-ink-muted">
                Settlement status: {settlement.status}.
              </p>
            </div>
          </div>
        </div>
      ) : pending?.action === "APPROVE_SHIPPING" ? (
        <ConfirmPanel
          title={`Approve shipping for ${sellerName}?`}
          detail={`The deal moves to shipped with the tracking read from the guide. The ${formatMoney(amountCents)} stays held until ${buyerName} confirms receipt or the deadline passes.`}
          confirmLabel={submitting ? "Approving..." : "Confirm shipping"}
          pending={submitting}
          onConfirm={() => submit({ action: "APPROVE_SHIPPING" })}
          onCancel={cancel}
        />
      ) : pending?.action === "RELEASE" ? (
        <ConfirmPanel
          title={`Release ${formatMoney(amountCents)} to ${sellerName}?`}
          detail="The state machine records a pending payout. The deal stays with a mediator until PayPal confirms it."
          confirmLabel={submitting ? "Queueing payout..." : "Confirm release"}
          pending={submitting}
          onConfirm={() => submit({ action: "RELEASE" })}
          onCancel={cancel}
        />
      ) : pending?.action === "REFUND" ? (
        <ConfirmPanel
          title={`Refund ${formatMoney(amountCents)} to ${buyerName}?`}
          detail="The state machine records a pending refund. The deal stays with a mediator until PayPal confirms it."
          confirmLabel={submitting ? "Queueing refund..." : "Confirm refund"}
          pending={submitting}
          variant="destructive"
          onConfirm={() => submit({ action: "REFUND" })}
          onCancel={cancel}
        />
      ) : pending?.action === "REQUEST_EVIDENCE" ? (
        <div className="rounded-md border border-rule-line bg-kraft p-4">
          <p className="text-[0.9375rem] font-medium text-ink">
            Who needs to send more evidence?
          </p>
          <div
            role="group"
            aria-label="Evidence target"
            className="mt-3 flex flex-wrap gap-2"
          >
            {(["SELLER", "BUYER"] as const).map((option) => (
              <button
                key={option}
                type="button"
                disabled={submitting}
                aria-pressed={target === option}
                onClick={() => setTarget(option)}
                className={`h-11 rounded-md border px-4 text-[0.875rem] font-medium transition-colors duration-150 ease-out-quart focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-postal-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:pointer-events-none disabled:opacity-60 ${
                  target === option
                    ? "border-postal-ink bg-postal-ink text-on-postal-ink"
                    : "border-rule-line bg-sheet text-ink hover:bg-paper"
                }`}
              >
                {option === "SELLER" ? "Seller" : "Buyer"}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[0.875rem] leading-[1.55] text-ink-muted">
            The case returns to the {target === "SELLER" ? "seller" : "buyer"}.
            The money stays held.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              disabled={submitting}
              onClick={() => submit({ action: "REQUEST_EVIDENCE", target })}
            >
              {submitting ? "Sending request..." : "Send request"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={submitting}
              onClick={cancel}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {canApproveShipping ? (
            <Button
              type="button"
              onClick={() => setPending({ action: "APPROVE_SHIPPING" })}
            >
              Approve shipping
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => setPending({ action: "RELEASE" })}
            >
              Release to seller
            </Button>
          )}
          <Button
            type="button"
            variant="destructive"
            onClick={() => setPending({ action: "REFUND" })}
          >
            Refund buyer
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setPending({ action: "REQUEST_EVIDENCE" })}
          >
            Request more evidence
          </Button>
        </div>
      )}

      <p className="max-w-[65ch] text-[0.8125rem] leading-[1.5] text-ink-muted">
        Sandbox. Decisions are recorded in Supabase; money moves only after
        PayPal confirms it.
      </p>
    </section>
  );
}

function ConfirmPanel({
  title,
  detail,
  confirmLabel,
  pending,
  variant = "primary",
  onConfirm,
  onCancel,
}: {
  title: string;
  detail: string;
  confirmLabel: string;
  pending: boolean;
  variant?: "primary" | "destructive";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-md border border-rule-line bg-kraft p-4">
      <p className="text-[0.9375rem] font-medium text-ink">{title}</p>
      <p className="mt-1 text-[0.875rem] leading-[1.55] text-ink-muted">{detail}</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant={variant}
          disabled={pending}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
