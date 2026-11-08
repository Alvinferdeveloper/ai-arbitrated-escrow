import type { EvidenceSlot } from "@/lib/deals/types";

// Real photos, not canned results: they go through the same upload and audit
// as anything a user sends. Files live in public/demo-evidence/<id>/<slot>.jpg.
// Photos A and C show DEMO_SAMPLE_VERIFICATION_CODE handwritten on paper.

export const SAMPLE_LISTING = {
  title: "Computer mouse, black",
  description: "Used for six months, in good working condition, no cracks. Ships in a small box, about 0.35 kg packed.",
  priceUsd: "25.00",
} as const;

export type SampleScenario = {
  id: string;
  label: string;
  expected: string;
  /** Prefilled dispute reason for unboxing scenarios. */
  reason?: string;
};

export const SAMPLE_SCENARIOS: readonly SampleScenario[] = [
  {
    id: "honest",
    label: "Honest shipment",
    expected: "The audit passes and the deal ships.",
  },
  {
    id: "wrong-weight",
    label: "Wrong weight",
    expected: "The guide weight is far too high for the product, so the AI asks for a new guide photo.",
  },
  {
    id: "different-product",
    label: "Different product",
    expected: "Photo A shows another kind of product, so the AI cancels the deal and refunds the buyer.",
  },
];

export const UNBOXING_SCENARIOS: readonly SampleScenario[] = [
  {
    id: "unboxing-item-inside",
    label: "Item arrived",
    reason: "The box arrived empty.",
    expected: "The photo shows the item the seller shipped, so the claim fails and the seller is paid.",
  },
  {
    id: "unboxing-empty",
    label: "Empty box",
    reason: "The box arrived empty.",
    expected: "The photo contradicts the seller's parcel, so the case goes to a person.",
  },
];

export function samplePhotoUrl(scenarioId: string, slot: EvidenceSlot): string {
  return `/demo-evidence/${scenarioId}/${slot}.jpg`;
}
