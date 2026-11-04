import { EVIDENCE_SLOT_COPY } from "@/lib/deals/evidence";
import type {
  AuditReportView,
  Deal,
  DealView,
  EvidenceSlot,
  EvidenceView,
} from "@/lib/deals/types";

// Seeded demo data. No real people, no real PayPal accounts.

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
};

const honestAudit: AuditReportView = {
  checks: [
    {
      id: "product",
      label: "Product matches the listing",
      result: "cleared",
      detail: "The black headphones in photo A match the model and condition in the listing.",
    },
    {
      id: "packing",
      label: "Product is inside the packing",
      result: "cleared",
      detail: "Photo B shows the same headphones inside the box with the case and cable.",
    },
    {
      id: "parcel",
      label: "Parcel is sealed with a legible guide",
      result: "cleared",
      detail: "Photo C shows the closed parcel and the whole shipping guide.",
    },
    {
      id: "guide",
      label: "Guide data is readable",
      result: "cleared",
      detail: "Carrier, tracking number, weight and date are all legible.",
    },
  ],
  guide: {
    carrier: "UPS",
    trackingNumber: "1Z999AA10123456784",
    weightKg: "1.4 kg",
    date: "2026-10-28",
  },
  inconsistencies: [],
  triggeredRules: [],
};

const wrongWeightAudit: AuditReportView = {
  checks: [
    {
      id: "product",
      label: "Product matches the listing",
      result: "cleared",
      detail: "Photo A shows a white Switch OLED with the same joy-cons in the listing.",
    },
    {
      id: "packing",
      label: "Product is inside the packing",
      result: "cleared",
      detail: "Photo B shows the console, dock and cables inside the box.",
    },
    {
      id: "parcel",
      label: "Parcel is sealed with a legible guide",
      result: "cleared",
      detail: "Photo C shows a sealed parcel and a full guide.",
    },
    {
      id: "guide",
      label: "Guide data is readable",
      result: "cleared",
      detail: "All four fields on the guide are legible.",
    },
  ],
  guide: {
    carrier: "USPS",
    trackingNumber: "9400111899223856928498",
    weightKg: "0.4 kg",
    date: "2026-10-28",
  },
  inconsistencies: [
    "The guide records 0.4 kg. A Switch OLED with packing usually weighs 1.2 to 1.6 kg.",
  ],
  triggeredRules: ["WEIGHT_OUT_OF_RANGE"],
};

const disputeAudit: AuditReportView = {
  checks: [
    {
      id: "product",
      label: "Product matches the listing",
      result: "cleared",
      detail: "Photo A shows the same camera body and lens mount as the listing.",
    },
    {
      id: "packing",
      label: "Product is inside the packing",
      result: "cleared",
      detail: "Photo B shows the camera, battery and charger inside the box.",
    },
    {
      id: "parcel",
      label: "Parcel is sealed with a legible guide",
      result: "flagged",
      detail: "The tape in photo C does not match the tape in the buyer's unboxing photo.",
    },
    {
      id: "guide",
      label: "Guide data is readable",
      result: "cleared",
      detail: "Carrier, tracking number, weight and date are all legible.",
    },
  ],
  guide: {
    carrier: "FedEx",
    trackingNumber: "785432109876",
    weightKg: "1.9 kg",
    date: "2026-10-27",
  },
  inconsistencies: [
    "The buyer's unboxing photo shows a different serial number.",
    "The tape in photo C does not match the tape in the buyer's photo D.",
  ],
  triggeredRules: ["CONFLICTING_EVIDENCE"],
};

export const DEMO_DEALS: DemoDealRecord[] = [
  {
    id: "b1111111-1111-4111-8111-111111111111",
    title: "Sony WH-1000XM4 headphones",
    description: "Used for a year, no cracks. Includes the case, cable and original box.",
    priceCents: 3750,
    currency: "USD",
    state: "SHIPPED",
    seller: { id: DEMO_USERS.seller.id, displayName: DEMO_USERS.seller.displayName },
    buyer: { id: DEMO_USERS.buyer.id, displayName: DEMO_USERS.buyer.displayName },
    deliveryEstimateDays: 3,
    autoReleaseInMs: 46 * 60 * 60 * 1000,
    carrier: "UPS",
    trackingNumber: "1Z999AA10123456784",
    verificationCode: null,
    isSample: false,
    evidence: [evidence("A"), evidence("B"), evidence("C")],
    audit: honestAudit,
  },
  {
    id: "b2222222-2222-4222-8222-222222222222",
    title: "Nintendo Switch OLED, white",
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
    verificationCode: null,
    isSample: false,
    evidence: [evidence("A"), evidence("B"), evidence("C")],
    audit: wrongWeightAudit,
  },
  {
    id: "b3333333-3333-4333-8333-333333333333",
    title: "Canon EOS Rebel T7 camera",
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
    carrier: "FedEx",
    trackingNumber: "785432109876",
    verificationCode: null,
    isSample: false,
    evidence: [evidence("A"), evidence("B"), evidence("C")],
    audit: disputeAudit,
  },
];

export function getDemoDeals(now: Date = new Date()): DealView[] {
  return DEMO_DEALS.map(({ autoReleaseInMs, ...deal }) => ({
    ...deal,
    autoReleaseAt:
      autoReleaseInMs === null ? null : new Date(now.getTime() + autoReleaseInMs),
    createdAt: new Date(now.getTime() - 3 * 60 * 60 * 1000),
    evidenceDueAt: null,
    aiDecision: null,
  }));
}

export function getDemoDeal(id: string, now: Date = new Date()): DealView | null {
  return getDemoDeals(now).find((deal) => deal.id === id) ?? null;
}
