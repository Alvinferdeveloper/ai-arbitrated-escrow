import type { EscalationRuleId } from "@/lib/agents/rules.config";
import type { AuditReportView, DealParty, EvidenceView } from "@/lib/deals/types";
import type {
  MediatorAction,
  MediatorEvidenceTarget,
} from "@/lib/state-machine/mediator";

// Read models for the human mediation desk. A case only exists after a rule,
// a technical failure or an out-of-band reversal moved the deal to ESCALATED.

export type MediationActionId = MediatorAction;

export type EvidenceTarget = MediatorEvidenceTarget;

export type MediationTimelineActor = "buyer" | "seller" | "ai" | "system" | "mediator";

export type MediationTimelineEntry = {
  id: string;
  at: Date;
  actor: MediationTimelineActor;
  title: string;
  detail: string;
};

export type MediationSettlementView = {
  purpose: "PAYOUT" | "REFUND";
  status: string;
  createdAt: Date;
};

export type MediationCase = {
  id: string;
  state: "ESCALATED";
  title: string;
  priceCents: number;
  seller: DealParty;
  buyer: DealParty;
  reason: EscalationRuleId;
  reasonDetail: string;
  summary: string;
  claim: string;
  openedAt: Date;
  sellerEvidence: EvidenceView[];
  buyerEvidence: EvidenceView[];
  audit: AuditReportView | null;
  settlement: MediationSettlementView | null;
  /** True for a case escalated before the parcel left, with no dispute open. */
  canApproveShipping: boolean;
  timeline: MediationTimelineEntry[];
};

export type MediationQueueRow = {
  id: string;
  title: string;
  buyerName: string;
  amountCents: number;
  reason: EscalationRuleId;
  reasonLabel: string;
  age: string;
  state: "ESCALATED";
};

export type MediationDecision = {
  action: MediationActionId;
  target?: EvidenceTarget;
};
