import type { EvidenceItem } from "./evidence-submission";
import {
  transition,
  type TransitionEvent,
  type TransitionRecord,
} from "./transition";

// The buyer opens a dispute from SHIPPED, then the unboxing photo (D) starts
// the arbitration. Both steps write their rows atomically with the transition.

export interface DisputeStore {
  /** Fails when a payout or refund is already queued or the window closed. */
  openDispute(record: TransitionRecord, reason: string): Promise<TransitionEvent>;
  submitUnboxing(
    record: TransitionRecord,
    item: EvidenceItem,
  ): Promise<{ event: TransitionEvent; auditId: string }>;
}

export class InvalidUnboxingEvidenceError extends Error {
  constructor() {
    super("The unboxing evidence must be photo D");
    this.name = "InvalidUnboxingEvidenceError";
  }
}

export function openDispute(
  input: { dealId: string; reason: string },
  store: DisputeStore,
): Promise<TransitionEvent> {
  return transition(
    {
      dealId: input.dealId,
      from: "SHIPPED",
      to: "DISPUTED",
      actor: "buyer",
      payload: { claim: input.reason },
    },
    { transition: (record) => store.openDispute(record, input.reason) },
  );
}

export async function submitUnboxingEvidence(
  input: { dealId: string; item: EvidenceItem },
  store: DisputeStore,
): Promise<{ event: TransitionEvent; auditId: string }> {
  if (input.item.slot !== "D") throw new InvalidUnboxingEvidenceError();

  let auditId: string | null = null;

  const event = await transition(
    {
      dealId: input.dealId,
      from: "DISPUTED",
      to: "ARBITRATING",
      actor: "buyer",
      payload: {
        title: "Unboxing photo submitted",
        detail: "The buyer sent photo D. The arbitration is running.",
      },
    },
    {
      transition: async (record) => {
        const result = await store.submitUnboxing(record, input.item);
        auditId = result.auditId;
        return result.event;
      },
    },
  );

  if (!auditId) throw new Error("The unboxing submission returned no audit");

  return { event, auditId };
}
