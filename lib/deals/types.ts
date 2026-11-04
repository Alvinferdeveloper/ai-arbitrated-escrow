import type { AiRefundReason } from "@/lib/state-machine/ai-refund";
import type { DealState } from "@/lib/state-machine/states";

// Read models shared by the demo screens and, later, the Supabase queries.

export type DealParty = {
  id: string;
  displayName: string;
};

export type Deal = {
  id: string;
  title: string;
  description: string;
  priceCents: number;
  currency: "USD";
  state: DealState;
  seller: DealParty;
  buyer: DealParty;
  deliveryEstimateDays: number | null;
  autoReleaseAt: Date | null;
  carrier: string | null;
  trackingNumber: string | null;
  /** Handwritten by the seller in photos A and C; null on deals that predate it. */
  verificationCode: string | null;
  /** Demo deal started from the sample listing, whose photos were shot in advance. */
  isSample: boolean;
  createdAt: Date;
};

export type EvidenceSlot = "A" | "B" | "C" | "D";

export type EvidenceView = {
  slot: EvidenceSlot;
  title: string;
  description: string;
  status: "uploaded" | "missing";
  uploadedAt: Date | null;
  imageUrl: string | null;
};

export type AuditCheckResult = "cleared" | "blocked" | "flagged" | "skipped";

export type AuditCheck = {
  id: string;
  label: string;
  result: AuditCheckResult;
  detail: string;
};

export type GuideData = {
  carrier: string;
  trackingNumber: string;
  weightKg: string;
  date: string;
};

export type AuditReportView = {
  checks: AuditCheck[];
  guide: GuideData | null;
  inconsistencies: string[];
  triggeredRules: string[];
};

export type DealSummary = Pick<Deal, "id" | "title" | "priceCents" | "state" | "seller" | "buyer"> & {
  updatedAt: Date;
};

export type RetakeView = {
  slot: "A" | "B" | "C";
  instruction: string;
};

/** What the AI decided last, read from the event that moved the deal. */
export type AiDecisionView = {
  retakes: RetakeView[];
  attemptsLeft: number | null;
  detail: string | null;
};

export type DealView = Deal & {
  evidence: EvidenceView[];
  audit: AuditReportView | null;
  /** Set while the seller owes valid evidence; the buyer is refunded after it. */
  evidenceDueAt: Date | null;
  aiDecision: AiDecisionView | null;
  /** The state the deal left to reach its current one; tells how a final deal ended. */
  closedFrom: DealState | null;
  /** Why the AI refunded the buyer, when it did. */
  refundReason: AiRefundReason | null;
};
