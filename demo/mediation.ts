import { toAuditReportView } from "@/lib/agents/report";
import { ESCALATION_RULE_LABELS } from "@/lib/agents/rules.config";
import type { EvidenceAudit } from "@/lib/agents/schemas";
import { EVIDENCE_SLOT_COPY } from "@/lib/deals/evidence";
import type { EvidenceSlot, EvidenceView } from "@/lib/deals/types";
import { formatCaseAge } from "@/lib/mediation/age";
import type {
  MediationCase,
  MediationQueueRow,
  MediationTimelineActor,
  MediationTimelineEntry,
} from "@/lib/mediation/types";
import { DEMO_USERS, getDemoDeal } from "./data";

// Example mediation cases for local and no-Supabase mode, one per reason a
// person still gets a case: contradicting evidence, a payment reversed outside
// the deal, and an AI review that failed twice. Mirrored in supabase/seed.sql.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const CAMERA_ID = "b3333333-3333-4333-8333-333333333333";
const REVERSAL_ID = "b4444444-4444-4444-8444-444444444444";
const KEYBOARD_ID = "b5555555-5555-4555-8555-555555555555";

function evidence(slot: EvidenceSlot, uploadedAt: Date): EvidenceView {
  return {
    slot,
    ...EVIDENCE_SLOT_COPY[slot],
    status: "uploaded",
    uploadedAt,
    imageUrl: null,
  };
}

function timelineEntry(
  id: string,
  at: Date,
  actor: MediationTimelineActor,
  title: string,
  detail: string,
): MediationTimelineEntry {
  return { id, at, actor, title, detail };
}

const reversalAudit: EvidenceAudit = {
  product: {
    matchesListing: true,
    differentItem: false,
    identifierVisible: false,
    expectedWeightKg: 0.9,
    reason: "Photo A shows the handheld gaming PC and the carrying case in the listing.",
  },
  packing: { productInside: true, reason: "Photo B shows the console, case and charger inside the box." },
  parcel: { sealed: true, guideVisible: true, reason: "Photo C shows a sealed parcel with the whole guide." },
  guide: {
    readable: true,
    carrier: "City Courier",
    trackingNumber: "CC19876543",
    weightKg: 0.9,
    date: "2026-10-31",
    dateIso: "2026-10-31",
  },
  verification: { codeInPhotoA: "P9TB", codeInPhotoC: "P9TB" },
  inconsistencies: [],
};

const keyboardAudit: EvidenceAudit = {
  product: {
    matchesListing: true,
    differentItem: false,
    identifierVisible: false,
    expectedWeightKg: 1.1,
    reason: "Photo A shows the mechanical keyboard and its keycaps as described.",
  },
  packing: { productInside: true, reason: "Photo B shows the keyboard and cable inside the box." },
  parcel: { sealed: true, guideVisible: true, reason: "Photo C shows the sealed parcel and a legible guide." },
  guide: {
    readable: true,
    carrier: "National Post",
    trackingNumber: "NP9400112233",
    weightKg: 1.1,
    date: "2026-10-30",
    dateIso: "2026-10-30",
  },
  verification: { codeInPhotoA: "W3NF", codeInPhotoC: "W3NF" },
  inconsistencies: [],
};

function buildCameraCase(now: Date): MediationCase {
  const deal = getDemoDeal(CAMERA_ID, now);

  if (!deal?.audit) {
    throw new Error("The camera example deal is missing from demo/data.ts");
  }

  return {
    id: deal.id,
    state: "ESCALATED",
    title: deal.title,
    priceCents: deal.priceCents,
    seller: deal.seller,
    buyer: deal.buyer,
    reason: "CONFLICTING_EVIDENCE",
    reasonDetail: "Photo C and photo D disagree on the parcel tape and the serial number.",
    summary:
      "The buyer's unboxing photo shows a different serial number and tape than the seller's sealed parcel. The AI cannot tell who is right, so a person decides.",
    claim:
      "The box arrived with a different camera body, and the tape was already cut when it reached me.",
    openedAt: new Date(now.getTime() - 6 * HOUR - 12 * MINUTE),
    sellerEvidence: deal.evidence.filter((item) => item.slot !== "D"),
    buyerEvidence: [evidence("D", new Date(now.getTime() - 7 * HOUR))],
    audit: deal.audit,
    settlement: null,
    canApproveShipping: false,
    isExample: true,
    timeline: [
      timelineEntry("camera-payment", new Date(now.getTime() - 50 * HOUR), "system", "Payment captured", "85.00 USD is held in the platform account."),
      timelineEntry("camera-evidence", new Date(now.getTime() - 48 * HOUR), "seller", "Seller uploaded photos A, B and C", "The guide shows National Post NP7854321098, 1.9 kg."),
      timelineEntry("camera-audit", new Date(now.getTime() - 47 * HOUR), "ai", "Audit passed", "Every check passed and the deal shipped."),
      timelineEntry("camera-dispute", new Date(now.getTime() - 7 * HOUR), "buyer", "Buyer opened a dispute", "The buyer uploaded photo D and described a different serial number."),
      timelineEntry("camera-escalated", new Date(now.getTime() - 6 * HOUR - 12 * MINUTE), "ai", "Escalated: conflicting evidence", "Photo C and photo D contradict each other. The money stays held."),
    ],
  };
}

function buildReversalCase(now: Date): MediationCase {
  return {
    id: REVERSAL_ID,
    state: "ESCALATED",
    title: "Handheld gaming PC, 512 GB",
    priceCents: 10000,
    seller: { id: DEMO_USERS.secondSeller.id, displayName: DEMO_USERS.secondSeller.displayName },
    buyer: { id: DEMO_USERS.secondBuyer.id, displayName: DEMO_USERS.secondBuyer.displayName },
    reason: "OUT_OF_BAND_REVERSAL",
    reasonDetail:
      "PayPal reversed the buyer's payment outside the deal, after the parcel had shipped.",
    summary:
      "The buyer claimed the payment back through PayPal instead of opening a dispute here. The evidence passed and the parcel shipped, so a person decides what the seller is owed.",
    claim: "No dispute was opened here. The buyer went straight to PayPal.",
    openedAt: new Date(now.getTime() - 28 * HOUR),
    sellerEvidence: [
      evidence("A", new Date(now.getTime() - 47 * HOUR)),
      evidence("B", new Date(now.getTime() - 47 * HOUR)),
      evidence("C", new Date(now.getTime() - 47 * HOUR)),
    ],
    buyerEvidence: [],
    audit: toAuditReportView(reversalAudit, [], { verificationCode: "P9TB", isSample: false }),
    settlement: null,
    canApproveShipping: false,
    isExample: true,
    timeline: [
      timelineEntry("reversal-payment", new Date(now.getTime() - 50 * HOUR), "system", "Payment captured", "100.00 USD is held in the platform account."),
      timelineEntry("reversal-evidence", new Date(now.getTime() - 47 * HOUR), "seller", "Seller uploaded photos A, B and C", "The guide shows City Courier CC19876543, 0.9 kg."),
      timelineEntry("reversal-audit", new Date(now.getTime() - 46 * HOUR), "ai", "Audit passed", "Every check passed and the deal shipped."),
      timelineEntry("reversal-escalated", new Date(now.getTime() - 28 * HOUR), "system", "Escalated: payment reversed outside the deal", "PayPal reported a reversal of the buyer's payment. The deal stops until a person decides."),
    ],
  };
}

function buildKeyboardCase(now: Date): MediationCase {
  return {
    id: KEYBOARD_ID,
    state: "ESCALATED",
    title: "Mechanical keyboard, brown switches",
    priceCents: 4500,
    seller: { id: DEMO_USERS.seller.id, displayName: DEMO_USERS.seller.displayName },
    buyer: { id: DEMO_USERS.buyer.id, displayName: DEMO_USERS.buyer.displayName },
    reason: "TECHNICAL_FAILURE",
    reasonDetail: "The AI review of the dispute failed twice. The retry did not recover.",
    summary:
      "The seller's evidence passed, but the AI review of the dispute failed before it could compare both sides. A person reads the photos instead.",
    claim:
      "Two switches are broken and the space bar sticks. The seller says the keyboard was tested before shipping.",
    openedAt: new Date(now.getTime() - 26 * HOUR),
    sellerEvidence: [
      evidence("A", new Date(now.getTime() - 77 * HOUR)),
      evidence("B", new Date(now.getTime() - 77 * HOUR)),
      evidence("C", new Date(now.getTime() - 77 * HOUR)),
    ],
    buyerEvidence: [evidence("D", new Date(now.getTime() - 30 * HOUR))],
    audit: toAuditReportView(keyboardAudit, [], { verificationCode: "W3NF", isSample: false }),
    settlement: null,
    canApproveShipping: false,
    isExample: true,
    timeline: [
      timelineEntry("keyboard-payment", new Date(now.getTime() - 80 * HOUR), "system", "Payment captured", "45.00 USD is held in the platform account."),
      timelineEntry("keyboard-evidence", new Date(now.getTime() - 77 * HOUR), "seller", "Seller uploaded photos A, B and C", "The guide shows National Post NP9400112233, 1.1 kg."),
      timelineEntry("keyboard-shipped", new Date(now.getTime() - 75 * HOUR), "ai", "Audit passed", "Every check passed and the deal shipped."),
      timelineEntry("keyboard-dispute", new Date(now.getTime() - 30 * HOUR), "buyer", "Buyer opened a dispute", "The buyer uploaded photo D and described two broken switches."),
      timelineEntry("keyboard-escalated", new Date(now.getTime() - 26 * HOUR), "system", "Escalated: technical failure", "The AI review failed twice. The money stays held."),
    ],
  };
}

export function getDemoMediationCases(now: Date = new Date()): MediationCase[] {
  return [buildCameraCase(now), buildReversalCase(now), buildKeyboardCase(now)].sort(
    (left, right) => left.openedAt.getTime() - right.openedAt.getTime(),
  );
}

export function getDemoMediationCase(
  id: string,
  now: Date = new Date(),
): MediationCase | null {
  return getDemoMediationCases(now).find((caseFile) => caseFile.id === id) ?? null;
}

export function getDemoMediationQueue(now: Date = new Date()): MediationQueueRow[] {
  return getDemoMediationCases(now).map((caseFile) => ({
    id: caseFile.id,
    title: caseFile.title,
    buyerName: caseFile.buyer.displayName,
    amountCents: caseFile.priceCents,
    reason: caseFile.reason,
    reasonLabel: ESCALATION_RULE_LABELS[caseFile.reason],
    age: formatCaseAge(caseFile.openedAt, now),
    openedAt: caseFile.openedAt.toISOString(),
    state: "ESCALATED",
  }));
}
