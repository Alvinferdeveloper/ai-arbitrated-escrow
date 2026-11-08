import type { EvidenceAuditInput, EvidencePhotoSlot } from "@/lib/agents/ports";
import { DEMO_SAMPLE_VERIFICATION_CODE } from "@/lib/config";
import { SAMPLE_LISTING } from "@/demo/sample-evidence";
import type { EvalExpectation } from "./score";

// Photo paths are relative to public/demo-evidence. Several cases reuse a set
// against another listing, code or date, so the deal changes and the photos don't.

type SellerPhotos = Record<EvidencePhotoSlot, string>;

type BaseCase = {
  id: string;
  /** What the case proves, shown in the report. */
  title: string;
  listing: EvidenceAuditInput;
  expected: EvalExpectation;
};

export type AuditCase = BaseCase & {
  kind: "audit";
  photos: SellerPhotos;
  verificationCode: string;
  /** Turns on the date checks, which sample deals skip because their photos are older. */
  dealCreatedAt?: string;
};

export type DisputeCase = BaseCase & {
  kind: "dispute";
  photos: SellerPhotos;
  unboxing: string;
  disputeReason: string;
};

export type EvalCase = AuditCase | DisputeCase;

function photoSet(id: string): SellerPhotos {
  return { A: `${id}/A.jpg`, B: `${id}/B.jpg`, C: `${id}/C.jpg` };
}

const LISTING: EvidenceAuditInput = {
  title: SAMPLE_LISTING.title,
  description: SAMPLE_LISTING.description,
  priceCents: 2500,
};

const CODE = DEMO_SAMPLE_VERIFICATION_CODE;
const HONEST = photoSet("honest");

export const EVAL_CASES: readonly EvalCase[] = [
  {
    id: "honest-shipment",
    kind: "audit",
    title: "Honest seller ships",
    listing: LISTING,
    photos: HONEST,
    verificationCode: CODE,
    expected: { outcome: "PASS" },
  },
  {
    id: "wrong-weight",
    kind: "audit",
    title: "Guide weight far too high for the product",
    listing: LISTING,
    photos: photoSet("wrong-weight"),
    verificationCode: CODE,
    expected: { outcome: "RETAKE", rules: ["WEIGHT_OUT_OF_RANGE"], retakeSlots: ["C"] },
  },
  {
    id: "different-product",
    kind: "audit",
    title: "Photo A shows another kind of product",
    listing: LISTING,
    photos: photoSet("different-product"),
    verificationCode: CODE,
    expected: { outcome: "REFUND", rules: ["PRODUCT_MISMATCH"] },
  },
  {
    id: "listing-is-another-product",
    kind: "audit",
    title: "The photos are real, but the listing sells something else",
    listing: {
      title: "Ceramic coffee mug, white",
      description: "Holds 350 ml. Dishwasher safe, no chips.",
      priceCents: 1500,
    },
    photos: HONEST,
    verificationCode: CODE,
    expected: { outcome: "REFUND", rules: ["PRODUCT_MISMATCH"] },
  },
  {
    id: "listing-is-another-color",
    kind: "audit",
    title: "Same product in another color than listed",
    listing: { ...LISTING, title: "Computer mouse, white" },
    photos: HONEST,
    verificationCode: CODE,
    expected: { outcome: "RETAKE", rules: ["PRODUCT_MISMATCH"], retakeSlots: ["A"] },
  },
  {
    id: "wrong-verification-code",
    kind: "audit",
    title: "Photos made for another deal: the handwritten code differs",
    listing: LISTING,
    photos: HONEST,
    verificationCode: "X9Z2",
    expected: { outcome: "RETAKE", rules: ["VERIFICATION_CODE"], retakeSlots: ["A", "C"] },
  },
  {
    id: "guide-predates-deal",
    kind: "audit",
    title: "The guide is dated before the deal existed",
    listing: LISTING,
    photos: HONEST,
    verificationCode: CODE,
    dealCreatedAt: "2035-01-01T00:00:00Z",
    expected: { outcome: "RETAKE", rules: ["GUIDE_PREDATES_DEAL"], retakeSlots: ["C"] },
  },
  {
    id: "high-value-without-serial",
    kind: "audit",
    title: "High-value deal with no legible serial number",
    listing: { ...LISTING, priceCents: 90_000 },
    photos: HONEST,
    verificationCode: CODE,
    expected: { outcome: "RETAKE", rules: ["HIGH_VALUE"], retakeSlots: ["A"] },
  },
  {
    id: "packing-photo-missing-product",
    kind: "audit",
    title: "Photo B shows the closed parcel, not the product in its box",
    listing: LISTING,
    photos: { ...HONEST, B: HONEST.C },
    verificationCode: CODE,
    expected: { outcome: "RETAKE", retakeSlots: ["B"] },
  },
  {
    id: "dispute-buyer-lies-empty",
    kind: "dispute",
    title: "Buyer claims an empty box, the photo shows the item",
    listing: LISTING,
    photos: HONEST,
    unboxing: "unboxing-item-inside/D.jpg",
    disputeReason: "The box arrived empty.",
    expected: { outcome: "RELEASE" },
  },
  {
    id: "dispute-buyer-lies-wrong-item",
    kind: "dispute",
    title: "Buyer claims a wrong item, the photo shows the right one",
    listing: LISTING,
    photos: HONEST,
    unboxing: "unboxing-item-inside/D.jpg",
    disputeReason: "This is not the item I ordered.",
    expected: { outcome: "RELEASE" },
  },
  {
    id: "dispute-empty-parcel",
    kind: "dispute",
    title: "The unboxing photo contradicts the seller's parcel",
    listing: LISTING,
    photos: HONEST,
    unboxing: "unboxing-empty/D.jpg",
    disputeReason: "The box arrived empty.",
    expected: { outcome: "ESCALATE" },
  },
];

export function casePhotos(evalCase: EvalCase): string[] {
  const seller = Object.values(evalCase.photos);
  return evalCase.kind === "dispute" ? [...seller, evalCase.unboxing] : seller;
}
