// Single source of truth for deal states and valid transitions.
// Every state change goes through `transition()` in this module and is written to `events`.
// Released and Refunded are only reached from a PayPal webhook, never from a request handler.

export const DEAL_STATES = [
  "AWAITING_PAYMENT", // Trust Link shared, buyer has not paid
  "FUNDS_HELD", // capture confirmed by webhook, waiting for seller evidence
  "AUDITING", // AI audit of photos A, B, C running
  "EVIDENCE_REJECTED", // audit blocked shipping, seller may re-upload
  "SHIPPED", // audit passed, tracking attached, dispute window open
  "DISPUTED", // buyer opened a dispute, waiting for unboxing evidence
  "ARBITRATING", // engine comparing seller and buyer evidence
  "ESCALATED", // with the human mediator
  "RELEASED", // payout confirmed by webhook (final)
  "REFUNDED", // refund confirmed by webhook (final)
] as const;

export type DealState = (typeof DEAL_STATES)[number];

export type Actor = "buyer" | "seller" | "mediator" | "ai" | "system" | "paypal";

export const FINAL_STATES: readonly DealState[] = ["RELEASED", "REFUNDED"];

/** Allowed transitions. Anything not listed here is rejected. */
export const TRANSITIONS: Record<DealState, readonly DealState[]> = {
  AWAITING_PAYMENT: ["FUNDS_HELD"],
  FUNDS_HELD: ["AUDITING", "ESCALATED"],
  AUDITING: ["SHIPPED", "EVIDENCE_REJECTED", "ESCALATED"],
  EVIDENCE_REJECTED: ["AUDITING", "ESCALATED"],
  SHIPPED: ["DISPUTED", "RELEASED", "ESCALATED"],
  DISPUTED: ["ARBITRATING", "ESCALATED"],
  ARBITRATING: ["RELEASED", "REFUNDED", "ESCALATED"],
  // Mediator: release, refund, request more evidence (back to seller or buyer),
  // or approve shipping for a case escalated before the parcel left.
  ESCALATED: ["RELEASED", "REFUNDED", "FUNDS_HELD", "DISPUTED", "SHIPPED"],
  RELEASED: [],
  REFUNDED: [],
};

export function canTransition(from: DealState, to: DealState): boolean {
  return TRANSITIONS[from].includes(to);
}
