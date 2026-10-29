import { ESCALATION_RULE_LABELS } from "@/lib/agents/rules.config";
import { EVIDENCE_SLOT_COPY } from "@/lib/deals/evidence";
import type {
  AuditCheck,
  AuditReportView,
  EvidenceSlot,
  EvidenceView,
} from "@/lib/deals/types";
import { formatCaseAge } from "@/lib/mediation/age";
import type {
  MediationCase,
  MediationQueueRow,
  MediationTimelineActor,
  MediationTimelineEntry,
} from "@/lib/mediation/types";
import { DEMO_USERS, getDemoDeal } from "./data";

// Seeded mediation cases for local and no-Supabase mode. Every case is already
// ESCALATED and the money is held. When Supabase is configured, the same screens
// read the database instead; these objects are only a visual fallback.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const CANON_DEAL_ID = "b3333333-3333-4333-8333-333333333333";
const STEAM_DECK_ID = "b4444444-4444-4444-8444-444444444444";
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

function clearedChecks(product: string, packing: string, parcel: string, guide: string): AuditCheck[] {
  return [
    {
      id: "product",
      label: "Product matches the listing",
      result: "cleared",
      detail: product,
    },
    {
      id: "packing",
      label: "Product is inside the packing",
      result: "cleared",
      detail: packing,
    },
    {
      id: "parcel",
      label: "Parcel is sealed with a legible guide",
      result: "cleared",
      detail: parcel,
    },
    {
      id: "guide",
      label: "Guide data is readable",
      result: "cleared",
      detail: guide,
    },
  ];
}

const steamAudit: AuditReportView = {
  checks: clearedChecks(
    "Photo A shows the Steam Deck OLED and the carrying case in the listing.",
    "Photo B shows the console, case and charger inside the box.",
    "Photo C shows a sealed parcel with the whole UPS guide.",
    "The guide reads 0.9 kg, with carrier, tracking number and date.",
  ),
  guide: {
    carrier: "UPS",
    trackingNumber: "1Z999AA10198765432",
    weightKg: "0.9 kg",
    date: "2026-10-27",
  },
  inconsistencies: [],
  triggeredRules: [],
};

const keyboardAudit: AuditReportView = {
  checks: clearedChecks(
    "Photo A shows the Keychron K2 and its keycaps as described.",
    "Photo B shows the keyboard and cable inside the box.",
    "Photo C shows the sealed parcel and a legible guide.",
    "The guide reads 1.1 kg, with carrier, tracking number and date.",
  ),
  guide: {
    carrier: "USPS",
    trackingNumber: "9400111899223856123456",
    weightKg: "1.1 kg",
    date: "2026-10-26",
  },
  inconsistencies: [],
  triggeredRules: [],
};

function buildCanonCase(now: Date): MediationCase {
  const deal = getDemoDeal(CANON_DEAL_ID, now);

  if (!deal?.audit) {
    throw new Error("The Canon demo deal is missing from demo/data.ts");
  }

  return {
    id: deal.id,
    state: "ESCALATED",
    title: deal.title,
    priceCents: deal.priceCents,
    seller: deal.seller,
    buyer: deal.buyer,
    reason: "CONFLICTING_EVIDENCE",
    reasonDetail:
      "Photo C and photo D disagree on the parcel tape and the serial number.",
    summary:
      "The buyer's unboxing photo shows a different serial number and tape than the seller's sealed parcel. The rule asks for a person.",
    claim:
      "The box arrived with a different camera body, and the tape was already cut when it reached me.",
    openedAt: new Date(now.getTime() - 6 * HOUR - 12 * MINUTE),
    sellerEvidence: deal.evidence.filter((item) => item.slot !== "D"),
    buyerEvidence: [evidence("D", new Date(now.getTime() - 7 * HOUR))],
    audit: deal.audit,
    settlement: null,
    timeline: [
      timelineEntry(
        "canon-payment",
        new Date(now.getTime() - 50 * HOUR),
        "system",
        "Payment captured",
        "85.00 USD is held in the platform account.",
      ),
      timelineEntry(
        "canon-evidence",
        new Date(now.getTime() - 48 * HOUR),
        "seller",
        "Seller uploaded photos A, B and C",
        "The guide shows FedEx 785432109876, 1.9 kg.",
      ),
      timelineEntry(
        "canon-audit",
        new Date(now.getTime() - 47 * HOUR),
        "ai",
        "Audit completed",
        "Four checks passed and two inconsistencies were recorded.",
      ),
      timelineEntry(
        "canon-dispute",
        new Date(now.getTime() - 7 * HOUR),
        "buyer",
        "Buyer opened a dispute",
        "The buyer uploaded photo D and described a different serial number.",
      ),
      timelineEntry(
        "canon-escalated",
        new Date(now.getTime() - 6 * HOUR - 12 * MINUTE),
        "system",
        "Escalated: conflicting evidence",
        "The rule sent the case to a mediator. The money stays held.",
      ),
    ],
  };
}

function buildSteamDeckCase(now: Date): MediationCase {
  return {
    id: STEAM_DECK_ID,
    state: "ESCALATED",
    title: "Steam Deck OLED, 512 GB",
    priceCents: 10000,
    seller: {
      id: DEMO_USERS.secondSeller.id,
      displayName: DEMO_USERS.secondSeller.displayName,
    },
    buyer: {
      id: DEMO_USERS.secondBuyer.id,
      displayName: DEMO_USERS.secondBuyer.displayName,
    },
    reason: "WEIGHT_OUT_OF_RANGE",
    reasonDetail:
      "The buyer weighed the parcel at 0.4 kg. The guide records 0.9 kg.",
    summary:
      "The parcel arrived much lighter than the guide says. The buyer says the dock and the carrying case were missing.",
    claim:
      "The parcel felt too light. The dock and the carrying case were missing from the box.",
    openedAt: new Date(now.getTime() - 28 * HOUR),
    sellerEvidence: [
      evidence("A", new Date(now.getTime() - 47 * HOUR)),
      evidence("B", new Date(now.getTime() - 47 * HOUR)),
      evidence("C", new Date(now.getTime() - 47 * HOUR)),
    ],
    buyerEvidence: [evidence("D", new Date(now.getTime() - 30 * HOUR))],
    audit: steamAudit,
    settlement: null,
    timeline: [
      timelineEntry(
        "steam-payment",
        new Date(now.getTime() - 50 * HOUR),
        "system",
        "Payment captured",
        "100.00 USD is held in the platform account.",
      ),
      timelineEntry(
        "steam-evidence",
        new Date(now.getTime() - 47 * HOUR),
        "seller",
        "Seller uploaded photos A, B and C",
        "The guide shows UPS 1Z999AA10198765432, 0.9 kg.",
      ),
      timelineEntry(
        "steam-audit",
        new Date(now.getTime() - 46 * HOUR),
        "ai",
        "Audit passed",
        "The four checks passed and the deal was marked as shipped.",
      ),
      timelineEntry(
        "steam-dispute",
        new Date(now.getTime() - 30 * HOUR),
        "buyer",
        "Buyer opened a dispute",
        "The buyer uploaded photo D and recorded 0.4 kg on a kitchen scale.",
      ),
      timelineEntry(
        "steam-escalated",
        new Date(now.getTime() - 28 * HOUR),
        "ai",
        "Escalated: weight out of range",
        "The buyer's weight is below the expected range. The money stays held.",
      ),
    ],
  };
}

function buildKeyboardCase(now: Date): MediationCase {
  return {
    id: KEYBOARD_ID,
    state: "ESCALATED",
    title: "Keychron K2 mechanical keyboard",
    priceCents: 4500,
    seller: {
      id: DEMO_USERS.seller.id,
      displayName: DEMO_USERS.seller.displayName,
    },
    buyer: {
      id: DEMO_USERS.buyer.id,
      displayName: DEMO_USERS.buyer.displayName,
    },
    reason: "TECHNICAL_FAILURE",
    reasonDetail:
      "The arbitration model returned invalid output twice. The retry did not recover.",
    summary:
      "The seller's evidence passed, but the automatic dispute review failed before it could compare both sides. A person needs to read the photos.",
    claim:
      "Two switches are broken and the space bar sticks. The seller says the keyboard was tested before shipping.",
    openedAt: new Date(now.getTime() - 26 * HOUR),
    sellerEvidence: [
      evidence("A", new Date(now.getTime() - 77 * HOUR)),
      evidence("B", new Date(now.getTime() - 77 * HOUR)),
      evidence("C", new Date(now.getTime() - 77 * HOUR)),
    ],
    buyerEvidence: [evidence("D", new Date(now.getTime() - 30 * HOUR))],
    audit: keyboardAudit,
    settlement: null,
    timeline: [
      timelineEntry(
        "keyboard-payment",
        new Date(now.getTime() - 80 * HOUR),
        "system",
        "Payment captured",
        "45.00 USD is held in the platform account.",
      ),
      timelineEntry(
        "keyboard-evidence",
        new Date(now.getTime() - 77 * HOUR),
        "seller",
        "Seller uploaded photos A, B and C",
        "The guide shows USPS 9400111899223856123456, 1.1 kg.",
      ),
      timelineEntry(
        "keyboard-shipped",
        new Date(now.getTime() - 75 * HOUR),
        "ai",
        "Audit passed",
        "The seller's evidence passed and the deal was marked as shipped.",
      ),
      timelineEntry(
        "keyboard-dispute",
        new Date(now.getTime() - 30 * HOUR),
        "buyer",
        "Buyer opened a dispute",
        "The buyer uploaded photo D and described two broken switches.",
      ),
      timelineEntry(
        "keyboard-failure",
        new Date(now.getTime() - 28 * HOUR),
        "ai",
        "Dispute review failed",
        "The model returned invalid output. The cron retry failed again.",
      ),
      timelineEntry(
        "keyboard-escalated",
        new Date(now.getTime() - 26 * HOUR),
        "system",
        "Escalated: technical failure",
        "A person needs to review the evidence. The money stays held.",
      ),
    ],
  };
}

export function getDemoMediationCases(now: Date = new Date()): MediationCase[] {
  return [buildCanonCase(now), buildSteamDeckCase(now), buildKeyboardCase(now)].sort(
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
    state: "ESCALATED",
  }));
}

