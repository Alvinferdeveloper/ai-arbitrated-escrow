import { randomUUID } from "node:crypto";
import {
  transition,
  type TransitionEvent,
  type TransitionRecord,
} from "./transition";

// The AI cancels a deal before shipping and refunds the buyer. The refund row
// is queued with the transition to REFUNDING; PayPal's webhook sets REFUNDED.

export const AI_REFUND_REASONS = [
  "DIFFERENT_ITEM",
  "ATTEMPTS_EXHAUSTED",
  "EVIDENCE_TIMEOUT",
] as const;
export type AiRefundReason = (typeof AI_REFUND_REASONS)[number];

export const AI_REFUND_COPY: Record<AiRefundReason, string> = {
  DIFFERENT_ITEM:
    "Photo A shows another product than the listing, so the AI cancelled the deal and refunded the buyer.",
  ATTEMPTS_EXHAUSTED:
    "The seller could not provide valid evidence after the allowed attempts, so the AI refunded the buyer.",
  EVIDENCE_TIMEOUT:
    "The seller did not send valid evidence before the deadline, so the AI refunded the buyer.",
};

export interface AiRefundStore {
  /** Moves the deal to REFUNDING and queues the refund row atomically. */
  startRefund(record: TransitionRecord, idempotencyKey: string): Promise<TransitionEvent>;
}

export type StartAiRefundInput = {
  dealId: string;
  from: "FUNDS_HELD" | "AUDITING" | "EVIDENCE_REJECTED";
  /** `ai` for an audit verdict, `system` for the evidence deadline. */
  actor: "ai" | "system";
  reason: AiRefundReason;
};

export function startAiRefund(
  input: StartAiRefundInput,
  store: AiRefundStore,
): Promise<TransitionEvent> {
  const idempotencyKey = `ai-refund-${randomUUID()}`;

  return transition(
    {
      dealId: input.dealId,
      from: input.from,
      to: "REFUNDING",
      actor: input.actor,
      payload: { reason: input.reason, detail: AI_REFUND_COPY[input.reason] },
    },
    { transition: (record) => store.startRefund(record, idempotencyKey) },
  );
}
