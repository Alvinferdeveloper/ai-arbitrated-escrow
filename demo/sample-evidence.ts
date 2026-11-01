import type { EvidencePhotoSlot } from "@/lib/agents/ports";

// Real photos, not canned results: they go through the same upload and audit
// as anything a seller sends. Files live in public/demo-evidence/<id>/{A,B,C}.jpg.

export const SAMPLE_LISTING = {
  title: "Sony WH-1000XM4 headphones, black",
  description:
    "Used for six months, no scratches. Includes the case and the charging cable.",
  priceUsd: "85.00",
} as const;

export type SampleScenario = {
  id: string;
  label: string;
  expected: string;
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
    expected: "The guide weight is too low for the product, so a mediator reviews it.",
  },
  {
    id: "different-product",
    label: "Different product",
    expected: "Photo A does not match the listing, so a mediator reviews it.",
  },
];

export function samplePhotoUrl(scenarioId: string, slot: EvidencePhotoSlot): string {
  return `/demo-evidence/${scenarioId}/${slot}.jpg`;
}
