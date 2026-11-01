import { formatMoney } from "@/lib/deals/money";
import type { MediationDecision } from "./types";

export type DecisionContext = {
  amountCents: number;
  sellerName: string;
  buyerName: string;
};

/**
 * Copy for a mediator decision after the state machine accepted it. A release
 * or refund is only queued here; the deal still waits for PayPal's webhook.
 */
export function describeMediationDecision(
  decision: MediationDecision,
  { amountCents, sellerName, buyerName }: DecisionContext,
): string {
  if (decision.action === "RELEASE") {
    return `The payout of ${formatMoney(amountCents)} to ${sellerName} is queued. The deal stays with a mediator until PayPal confirms the payout.`;
  }

  if (decision.action === "REFUND") {
    return `The refund of ${formatMoney(amountCents)} to ${buyerName} is queued. The deal stays with a mediator until PayPal confirms the refund.`;
  }

  if (decision.action === "APPROVE_SHIPPING") {
    return `Shipping is approved. ${sellerName} can send the parcel; the ${formatMoney(amountCents)} stays held until ${buyerName} confirms it arrived or the deadline passes.`;
  }

  const target = decision.target === "BUYER" ? "buyer" : "seller";
  return `The case is back with the ${target} for more evidence. The money stays held.`;
}
