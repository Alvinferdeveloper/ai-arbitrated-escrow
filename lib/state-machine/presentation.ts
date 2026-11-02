import type { DealState } from "./states";

// The only mapping from deal state to UI label, tone and next actor. Components read from here.

export type StateTone = "neutral" | "postal-ink" | "flagged" | "cleared" | "blocked";

export type StateIcon =
  | "clock"
  | "lock"
  | "scan"
  | "shield-x"
  | "truck"
  | "message"
  | "scale"
  | "gavel"
  | "check"
  | "refund";

export type StatePresentation = {
  label: string;
  tone: StateTone;
  icon: StateIcon;
  nextActor: "buyer" | "seller" | "mediator" | "system" | null;
  /** One plain sentence for the Holding Slip: who acts next and what happens. */
  nextAction: string;
};

export const STATE_PRESENTATION: Record<DealState, StatePresentation> = {
  AWAITING_PAYMENT: {
    label: "Waiting for payment",
    tone: "neutral",
    icon: "clock",
    nextActor: "buyer",
    nextAction:
      "Waiting for the buyer to pay. The seller can share the Trust Link again.",
  },
  FUNDS_HELD: {
    label: "Funds held",
    tone: "postal-ink",
    icon: "lock",
    nextActor: "seller",
    nextAction:
      "Waiting for the seller to upload photos A, B and C. Without valid evidence before the deadline, the buyer is refunded.",
  },
  AUDITING: {
    label: "Checking evidence",
    tone: "postal-ink",
    icon: "scan",
    nextActor: "system",
    nextAction:
      "Checking the photos and the shipping guide. This usually takes under 20 seconds.",
  },
  EVIDENCE_REJECTED: {
    label: "Evidence rejected",
    tone: "blocked",
    icon: "shield-x",
    nextActor: "seller",
    nextAction:
      "The AI asked the seller to retake specific photos. If they do not pass before the deadline, the buyer is refunded.",
  },
  SHIPPED: {
    label: "Shipped",
    tone: "postal-ink",
    icon: "truck",
    nextActor: "buyer",
    nextAction:
      "Waiting for the buyer to confirm the parcel arrived, or for the auto-release deadline.",
  },
  DISPUTED: {
    label: "Dispute open",
    tone: "flagged",
    icon: "message",
    nextActor: "buyer",
    nextAction:
      "Waiting for the buyer's unboxing photo and the reason for the dispute.",
  },
  ARBITRATING: {
    label: "Reviewing dispute",
    tone: "flagged",
    icon: "scale",
    nextActor: "system",
    nextAction:
      "Comparing the seller's evidence with the buyer's. A rule or a person decides.",
  },
  ESCALATED: {
    label: "With a mediator",
    tone: "flagged",
    icon: "gavel",
    nextActor: "mediator",
    nextAction: "A mediator is reviewing the case. The money stays held.",
  },
  REFUNDING: {
    label: "Refunding buyer",
    tone: "blocked",
    icon: "refund",
    nextActor: "system",
    nextAction:
      "The AI cancelled the deal before shipping. PayPal is returning the money to the buyer.",
  },
  RELEASED: {
    label: "Released to seller",
    tone: "cleared",
    icon: "check",
    nextActor: null,
    nextAction: "The money was released to the seller.",
  },
  REFUNDED: {
    label: "Refunded to buyer",
    tone: "blocked",
    icon: "refund",
    nextActor: null,
    nextAction: "The money was refunded to the buyer.",
  },
};
