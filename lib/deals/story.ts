import type { AiRefundReason } from "@/lib/state-machine/ai-refund";
import type { SlipAudience } from "@/lib/state-machine/presentation";
import type { DealState } from "@/lib/state-machine/states";
import { formatMoney } from "./money";

// What each screen says about the money and the evidence, by state and by
// reader. Pure, so no screen can describe money that already moved.

export type StoryDeal = {
  state: DealState;
  priceCents: number;
  sellerName: string;
  /** The state the deal left to reach its current one. */
  closedFrom: DealState | null;
  refundReason: AiRefundReason | null;
};

export type DealOutcome = { title: string; body: string };

const REFUND_REASON: Record<AiRefundReason, Record<SlipAudience, string>> = {
  DIFFERENT_ITEM: {
    buyer: "Photo A showed another product than the listing, so the AI cancelled the deal.",
    seller: "Photo A showed another product than the listing, so the AI cancelled the deal.",
  },
  ATTEMPTS_EXHAUSTED: {
    buyer: "The seller's photos did not pass after three attempts, so the AI cancelled the deal.",
    seller: "Your photos did not pass after three attempts, so the AI cancelled the deal.",
  },
  EVIDENCE_TIMEOUT: {
    buyer: "The seller did not send valid photos before the deadline, so the AI cancelled the deal.",
    seller: "You did not send valid photos before the deadline, so the AI cancelled the deal.",
  },
};

function refundCause(deal: StoryDeal, audience: SlipAudience): string {
  if (deal.closedFrom === "ARBITRATING") {
    return audience === "buyer"
      ? "The AI compared your unboxing photo with the seller's evidence and upheld your dispute."
      : "The AI compared the buyer's unboxing photo with your evidence and upheld the dispute.";
  }
  if (deal.closedFrom === "ESCALATED") return "A mediator reviewed both sides and refunded the buyer.";
  if (deal.refundReason) return REFUND_REASON[deal.refundReason][audience];
  return "The deal was cancelled before shipping.";
}

function releaseCause(deal: StoryDeal, audience: SlipAudience): string {
  if (deal.closedFrom === "ARBITRATING") {
    return "The AI compared the unboxing photo with the seller's evidence and did not uphold the dispute.";
  }
  if (deal.closedFrom === "ESCALATED") return "A mediator reviewed both sides and released the money.";
  return audience === "buyer"
    ? "Paid after you confirmed receipt or the auto-release deadline passed."
    : "Paid after the buyer confirmed receipt or the auto-release deadline passed.";
}

/** How the deal ended, or is ending. Null while it is still open. */
export function dealOutcome(deal: StoryDeal, audience: SlipAudience): DealOutcome | null {
  const amount = formatMoney(deal.priceCents);

  if (deal.state === "REFUNDING") {
    return {
      title: audience === "buyer" ? "You are being refunded" : "The buyer is being refunded",
      body: `${refundCause(deal, audience)} The refund of ${amount} is with PayPal and lands once PayPal confirms it.`,
    };
  }
  if (deal.state === "REFUNDED") {
    return {
      title: audience === "buyer" ? "You were refunded" : "The buyer was refunded",
      body: `${refundCause(deal, audience)} PayPal confirmed the refund of ${amount}.`,
    };
  }
  if (deal.state === "RELEASED") {
    return {
      title: audience === "buyer" ? `${deal.sellerName} was paid` : "You were paid",
      body: `${releaseCause(deal, audience)} PayPal confirmed the payout of ${amount}.`,
    };
  }
  return null;
}

/** The buyer's reassurance about the money. Null once the money has moved. */
export function buyerMoneyNote(deal: Pick<StoryDeal, "state" | "priceCents">): string | null {
  const amount = formatMoney(deal.priceCents);

  switch (deal.state) {
    case "AWAITING_PAYMENT":
      return `When you pay, we hold ${amount} instead of the seller. They are paid only after you confirm the parcel arrived or the deadline passes; if their evidence fails, the AI refunds you.`;
    case "FUNDS_HELD":
    case "AUDITING":
    case "EVIDENCE_REJECTED":
      return `We are holding ${amount}, not the seller. Nothing ships until the AI clears the seller's photos; if they do not pass before the deadline, you are refunded automatically.`;
    case "SHIPPED":
      return `We are holding ${amount} until you confirm the parcel arrived. If something is wrong, open a dispute before the deadline.`;
    case "DISPUTED":
    case "ARBITRATING":
    case "ESCALATED":
      return `We are holding ${amount} until the dispute is decided. Neither side can move it.`;
    default:
      return null;
  }
}

/** One line in place of empty photo slots when the seller sent nothing. */
export function missingEvidenceNote(state: DealState): string {
  switch (state) {
    case "AWAITING_PAYMENT":
      return "After you pay, the seller sends three photos: the product, the product packed, and the sealed parcel with its shipping guide. The AI audits them before anything ships.";
    case "FUNDS_HELD":
      return "The seller has not sent the photos yet. The AI audits them as soon as they arrive.";
    case "REFUNDING":
    case "REFUNDED":
      return "The seller sent no photos, so no audit ran.";
    default:
      return "No photos were sent.";
  }
}

/** The verification code matters while photos are expected or on record. */
export function showsVerificationCode(state: DealState, hasSellerPhotos: boolean): boolean {
  if (hasSellerPhotos) return true;
  return state === "FUNDS_HELD" || state === "AUDITING" || state === "EVIDENCE_REJECTED";
}
