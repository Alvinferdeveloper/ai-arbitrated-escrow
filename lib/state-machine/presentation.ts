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

/** True while the system, not a person, is expected to move the deal next. */
export function isWaitingOnSystem(state: DealState): boolean {
  return STATE_PRESENTATION[state].nextActor === "system";
}

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
      "Comparing the seller's evidence with the buyer's. If they contradict each other, a mediator decides.",
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

export type SlipAudience = "buyer" | "seller";

/** The Holding Slip line addressed to the person reading it. */
const AUDIENCE_NEXT_ACTION: Record<SlipAudience, Record<DealState, string>> = {
  buyer: {
    AWAITING_PAYMENT: "Your turn: pay with PayPal. The money is held here, not sent to the seller.",
    FUNDS_HELD:
      "Your money is held. The seller now sends photos A, B and C; if they do not pass before the deadline, you are refunded.",
    AUDITING: "The AI is checking the seller's photos and shipping guide. This usually takes under 20 seconds.",
    EVIDENCE_REJECTED:
      "The AI asked the seller for new photos. If they do not pass before the deadline, you are refunded.",
    SHIPPED:
      "Your turn: confirm the parcel arrived, or open a dispute. Otherwise the seller is paid at the deadline.",
    DISPUTED: "Your turn: add your unboxing photo. The money stays held.",
    ARBITRATING: "The AI is comparing your unboxing photo with the seller's evidence.",
    ESCALATED: "A mediator is reviewing both sides. The money stays held.",
    REFUNDING: "The AI cancelled the deal. PayPal is returning your money.",
    RELEASED: "The money was paid to the seller.",
    REFUNDED: "The money was refunded to you.",
  },
  seller: {
    AWAITING_PAYMENT: "Waiting for the buyer to pay. Share the Trust Link if you have not yet.",
    FUNDS_HELD: "Your turn: send photos A, B and C before the deadline, or the buyer is refunded.",
    AUDITING: "The AI is checking your photos and the shipping guide. This usually takes under 20 seconds.",
    EVIDENCE_REJECTED:
      "Your turn: retake the photos the AI asked for before the deadline, or the buyer is refunded.",
    SHIPPED: "Ship the parcel. You are paid when the buyer confirms receipt or the deadline passes.",
    DISPUTED: "The buyer opened a dispute. The money stays held while they add their unboxing photo.",
    ARBITRATING: "The AI is comparing the buyer's unboxing photo with your evidence.",
    ESCALATED: "A mediator is reviewing the case. The money stays held.",
    REFUNDING: "The AI cancelled the deal and is refunding the buyer.",
    RELEASED: "The money was paid to you.",
    REFUNDED: "The money was refunded to the buyer.",
  },
};

export function nextActionFor(state: DealState, audience?: SlipAudience): string {
  return audience ? AUDIENCE_NEXT_ACTION[audience][state] : STATE_PRESENTATION[state].nextAction;
}
