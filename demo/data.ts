import { toAuditReportView } from "@/lib/agents/report";
import type { EvidenceAudit } from "@/lib/agents/schemas";
import { EVIDENCE_SLOT_COPY } from "@/lib/deals/evidence";
import type {
  AiDecisionView,
  AuditReportView,
  Deal,
  DealView,
  EvidenceSlot,
  EvidenceView,
} from "@/lib/deals/types";

// Example deals: frozen snapshots of one step each, mirrored in supabase/seed.sql.
// No real people, no real PayPal accounts, no brand names.

export const DEMO_USERS = {
  seller: {
    id: "a1111111-1111-4111-8111-111111111111",
    displayName: "Marta Reyes",
    paypalEmail: "marta.reyes@example.com",
  },
  buyer: {
    id: "a2222222-2222-4222-8222-222222222222",
    displayName: "Kofi Mensah",
    paypalEmail: null,
  },
  mediator: {
    id: "a3333333-3333-4333-8333-333333333333",
    displayName: "Ana Solís",
    paypalEmail: null,
  },
  secondSeller: {
    id: "a4444444-4444-4444-8444-444444444444",
    displayName: "Diego Vargas",
    paypalEmail: "diego.vargas@example.com",
  },
  secondBuyer: {
    id: "a5555555-5555-4555-8555-555555555555",
    displayName: "Priya Nair",
    paypalEmail: null,
  },
} as const;

function evidence(
  slot: EvidenceSlot,
  status: EvidenceView["status"] = "uploaded",
): EvidenceView {
  return {
    slot,
    ...EVIDENCE_SLOT_COPY[slot],
    status,
    uploadedAt: null,
    imageUrl: null,
  };
}

type DemoDealRecord = Omit<Deal, "autoReleaseAt" | "createdAt"> & {
  autoReleaseInMs: number | null;
  evidence: EvidenceView[];
  audit: AuditReportView | null;
  aiDecision: AiDecisionView | null;
};

// The raw audits match supabase/seed.sql, so both modes render the same report.

const shippedAudit: EvidenceAudit = {
  product: {
    matchesListing: true,
    differentItem: false,
    identifierVisible: false,
    expectedWeightKg: 0.7,
    reason: "The black over-ear headphones in photo A match the model and condition in the listing.",
  },
  packing: { productInside: true, reason: "Photo B shows the same headphones inside the box with the case and cable." },
  parcel: { sealed: true, guideVisible: true, reason: "Photo C shows the closed parcel and the whole shipping guide." },
  guide: {
    readable: true,
    carrier: "National Post",
    trackingNumber: "NP4821773019",
    weightKg: 0.8,
    date: "2026-11-02",
    dateIso: "2026-11-02",
  },
  verification: { codeInPhotoA: "H4XR", codeInPhotoC: "H4XR" },
  inconsistencies: [],
};

const rejectedAudit: EvidenceAudit = {
  product: {
    matchesListing: true,
    differentItem: false,
    identifierVisible: false,
    expectedWeightKg: 1.4,
    reason: "Photo A shows a white handheld console with both controllers, as in the listing.",
  },
  packing: { productInside: true, reason: "Photo B shows the console, dock and cables inside the box." },
  parcel: { sealed: true, guideVisible: true, reason: "Photo C shows a sealed parcel and a full guide." },
  guide: {
    readable: true,
    carrier: "City Courier",
    trackingNumber: "CC55201984",
    weightKg: 0.4,
    date: "2026-11-02",
    dateIso: "2026-11-02",
  },
  verification: { codeInPhotoA: "M7KQ", codeInPhotoC: "M7KQ" },
  inconsistencies: [
    "The guide records 0.4 kg. This console with its dock and packing usually weighs 1.2 to 1.6 kg.",
  ],
};

const disputedAudit: EvidenceAudit = {
  product: {
    matchesListing: true,
    differentItem: false,
    identifierVisible: true,
    expectedWeightKg: 1.9,
    reason: "Photo A shows the camera body with the serial number on the base, as in the listing.",
  },
  packing: { productInside: true, reason: "Photo B shows the camera, battery and charger inside the box." },
  parcel: { sealed: true, guideVisible: true, reason: "Photo C shows the parcel sealed with clear tape and the whole guide." },
  guide: {
    readable: true,
    carrier: "National Post",
    trackingNumber: "NP7854321098",
    weightKg: 1.9,
    date: "2026-10-31",
    dateIso: "2026-10-31",
  },
  verification: { codeInPhotoA: "R2DW", codeInPhotoC: "R2DW" },
  inconsistencies: [],
};

const REJECTED_RETAKE =
  "Retake photo C: the guide weight does not fit this product (about 1.4 kg packed); weigh the parcel again and show the corrected guide.";

export const DEMO_DEALS: DemoDealRecord[] = [
  {
    id: "b1111111-1111-4111-8111-111111111111",
    title: "Wireless over-ear headphones, black",
    description: "Used for a year, no cracks. Includes the case, cable and original box.",
    priceCents: 3750,
    currency: "USD",
    state: "SHIPPED",
    seller: { id: DEMO_USERS.seller.id, displayName: DEMO_USERS.seller.displayName },
    buyer: { id: DEMO_USERS.buyer.id, displayName: DEMO_USERS.buyer.displayName },
    deliveryEstimateDays: 3,
    autoReleaseInMs: 46 * 60 * 60 * 1000,
    carrier: "National Post",
    trackingNumber: "NP4821773019",
    verificationCode: "H4XR",
    isSample: false,
    isExample: true,
    evidence: [evidence("A"), evidence("B"), evidence("C")],
    audit: toAuditReportView(shippedAudit, [], { verificationCode: "H4XR", isSample: false }),
    aiDecision: null,
  },
  {
    id: "b2222222-2222-4222-8222-222222222222",
    title: "Handheld game console, white",
    description: "New, opened once to check the screen. Dock and cables included.",
    priceCents: 9500,
    currency: "USD",
    state: "EVIDENCE_REJECTED",
    seller: {
      id: DEMO_USERS.secondSeller.id,
      displayName: DEMO_USERS.secondSeller.displayName,
    },
    buyer: { id: DEMO_USERS.buyer.id, displayName: DEMO_USERS.buyer.displayName },
    deliveryEstimateDays: 4,
    autoReleaseInMs: null,
    carrier: null,
    trackingNumber: null,
    verificationCode: "M7KQ",
    isSample: false,
    isExample: true,
    evidence: [evidence("A"), evidence("B"), evidence("C")],
    audit: toAuditReportView(rejectedAudit, ["WEIGHT_OUT_OF_RANGE"], {
      verificationCode: "M7KQ",
      isSample: false,
    }),
    aiDecision: {
      retakes: [{ slot: "C", instruction: REJECTED_RETAKE }],
      attemptsLeft: 2,
      detail: REJECTED_RETAKE,
    },
  },
  {
    id: "b3333333-3333-4333-8333-333333333333",
    title: "Mirrorless camera body, 24 MP",
    description: "Body only, 12,000 shutter count. Includes battery and charger.",
    priceCents: 8500,
    currency: "USD",
    state: "ESCALATED",
    seller: { id: DEMO_USERS.seller.id, displayName: DEMO_USERS.seller.displayName },
    buyer: {
      id: DEMO_USERS.secondBuyer.id,
      displayName: DEMO_USERS.secondBuyer.displayName,
    },
    deliveryEstimateDays: 5,
    autoReleaseInMs: null,
    carrier: "National Post",
    trackingNumber: "NP7854321098",
    verificationCode: "R2DW",
    isSample: false,
    isExample: true,
    evidence: [evidence("A"), evidence("B"), evidence("C"), evidence("D")],
    audit: toAuditReportView(disputedAudit, [], { verificationCode: "R2DW", isSample: false }),
    aiDecision: null,
  },
];

export function getDemoDeals(now: Date = new Date()): DealView[] {
  return DEMO_DEALS.map(({ autoReleaseInMs, ...deal }) => ({
    ...deal,
    autoReleaseAt:
      autoReleaseInMs === null ? null : new Date(now.getTime() + autoReleaseInMs),
    createdAt: new Date(now.getTime() - 3 * 60 * 60 * 1000),
    evidenceDueAt: null,
    closedFrom: null,
    refundReason: null,
  }));
}

export function getDemoDeal(id: string, now: Date = new Date()): DealView | null {
  return getDemoDeals(now).find((deal) => deal.id === id) ?? null;
}
