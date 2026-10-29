import type { EvidenceSlot } from "./types";

// One description per photo slot. Used by the seller upload and the buyer view.

export const EVIDENCE_SLOT_COPY: Record<
  EvidenceSlot,
  { title: string; description: string }
> = {
  A: {
    title: "The product",
    description: "A clear photo of the item being sold, with any marks visible.",
  },
  B: {
    title: "Product in packing",
    description: "The same item inside the box, before the parcel is sealed.",
  },
  C: {
    title: "Sealed parcel and guide",
    description: "The closed parcel next to the shipping guide, both readable.",
  },
  D: {
    title: "Unboxing",
    description: "The parcel and what came out of it, in one or two photos.",
  },
};
