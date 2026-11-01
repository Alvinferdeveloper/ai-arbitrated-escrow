import { randomUUID } from "node:crypto";
import { shipDeal, type Shipment, type ShippingStore } from "./shipping";
import {
  transition,
  type DealTransitionStore,
  type TransitionEvent,
} from "./transition";

// A mediator can request more evidence (a real state transition) or ask for a
// release/refund. Release and refund are settlement requests, not transitions:
// the deal stays ESCALATED until PayPal's webhook confirms the money moved.
// The pending payment row is written before any PayPal call, so a retry can
// reuse the same idempotency key. Approving shipping only applies before the parcel left.

export const MEDIATOR_ACTIONS = [
  "RELEASE",
  "REFUND",
  "REQUEST_EVIDENCE",
  "APPROVE_SHIPPING",
] as const;
export type MediatorAction = (typeof MEDIATOR_ACTIONS)[number];

export const MEDIATOR_EVIDENCE_TARGETS = ["SELLER", "BUYER"] as const;
export type MediatorEvidenceTarget =
  (typeof MEDIATOR_EVIDENCE_TARGETS)[number];

export const SETTLEMENT_PURPOSES = ["PAYOUT", "REFUND"] as const;
export type SettlementPurpose = (typeof SETTLEMENT_PURPOSES)[number];

export type PaymentStatus =
  | "CREATED"
  | "APPROVED"
  | "PENDING"
  | "COMPLETED"
  | "FAILED"
  | "DENIED"
  | "REFUNDED"
  | "REVERSED"
  | "BLOCKED"
  | "RETURNED"
  | "UNCLAIMED";

export type MediatorDecisionInput =
  | {
      dealId: string;
      action: "REQUEST_EVIDENCE";
      target: MediatorEvidenceTarget;
      note?: string;
    }
  | {
      dealId: string;
      action: "RELEASE" | "REFUND" | "APPROVE_SHIPPING";
      note?: string;
    };

export type MediationSettlement = {
  paymentId: string;
  purpose: SettlementPurpose;
  status: PaymentStatus;
  idempotencyKey: string;
};

export type MediatorDecisionResult =
  | {
      status: "EVIDENCE_REQUESTED";
      target: MediatorEvidenceTarget;
      event: TransitionEvent;
    }
  | {
      status: "SETTLEMENT_QUEUED";
      action: "RELEASE" | "REFUND";
      settlement: MediationSettlement;
    }
  | {
      status: "SHIPPING_APPROVED";
      event: TransitionEvent;
    };

export type QueueSettlementInput = {
  dealId: string;
  action: "RELEASE" | "REFUND";
  note?: string;
  idempotencyKey: string;
};

export interface MediatorDecisionStore extends DealTransitionStore, ShippingStore {
  /** Persists a pending PAYOUT/REFUND row without moving the deal state. */
  queueSettlement(input: QueueSettlementInput): Promise<MediationSettlement>;
  /** Carrier and tracking number read from the deal's latest finished audit. */
  auditedShipment(dealId: string): Promise<Shipment>;
}

export class MediationConflictError extends Error {
  constructor(
    readonly dealId: string,
    message: string,
  ) {
    super(`Deal ${dealId} cannot accept this mediator decision: ${message}`);
    this.name = "MediationConflictError";
  }
}

export async function submitMediatorDecision(
  input: MediatorDecisionInput,
  store: MediatorDecisionStore,
): Promise<MediatorDecisionResult> {
  if (input.action === "REQUEST_EVIDENCE") {
    // Seller needs to upload again; buyer needs to add unboxing evidence.
    const to = input.target === "SELLER" ? "FUNDS_HELD" : "DISPUTED";

    const event = await transition(
      {
        dealId: input.dealId,
        from: "ESCALATED",
        to,
        actor: "mediator",
        payload: {
          decision: input.action,
          target: input.target,
          ...(input.note ? { note: input.note } : {}),
        },
      },
      store,
    );

    return { status: "EVIDENCE_REQUESTED", target: input.target, event };
  }

  if (input.action === "APPROVE_SHIPPING") {
    const event = await shipDeal(
      {
        dealId: input.dealId,
        from: "ESCALATED",
        actor: "mediator",
        shipment: await store.auditedShipment(input.dealId),
        payload: {
          decision: input.action,
          ...(input.note ? { note: input.note } : {}),
        },
      },
      store,
    );

    return { status: "SHIPPING_APPROVED", event };
  }

  const settlement = await store.queueSettlement({
    dealId: input.dealId,
    action: input.action,
    note: input.note,
    // Stored before the future PayPal call. The per-deal payment row makes a
    // double click idempotent; this key is what the payout/refund wrapper uses.
    idempotencyKey: `mediator-${input.action.toLowerCase()}-${randomUUID()}`,
  });

  return { status: "SETTLEMENT_QUEUED", action: input.action, settlement };
}
