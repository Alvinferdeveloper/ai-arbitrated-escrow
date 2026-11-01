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

export type AuditCheckResult = "cleared" | "blocked" | "flagged";

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

export type DealView = Deal & {
  evidence: EvidenceView[];
  audit: AuditReportView | null;
};
