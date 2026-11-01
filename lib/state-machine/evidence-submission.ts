import { EVIDENCE_PHOTO_SLOTS } from "@/lib/agents/ports";
import type { EvidenceMediaType } from "@/lib/deals/evidence-upload";
import type { EvidenceSlot } from "@/lib/deals/types";
import {
  transition,
  type TransitionEvent,
  type TransitionRecord,
} from "./transition";

// Stores photos A, B and C, opens a PENDING audit and moves the deal to AUDITING atomically.

export type EvidenceItem = {
  slot: EvidenceSlot;
  storagePath: string;
  sha256: string;
  mediaType: EvidenceMediaType;
  sizeBytes: number;
  width: number;
  height: number;
  exif: Record<string, string | number | boolean | null>;
};

export interface EvidenceSubmissionStore {
  submit(
    record: TransitionRecord,
    items: readonly EvidenceItem[],
  ): Promise<{ event: TransitionEvent; auditId: string }>;
}

export class IncompleteEvidenceError extends Error {
  constructor() {
    super("Photos A, B and C are all required");
    this.name = "IncompleteEvidenceError";
  }
}

export type SubmitSellerEvidenceInput = {
  dealId: string;
  from: "FUNDS_HELD" | "EVIDENCE_REJECTED";
  items: readonly EvidenceItem[];
};

export async function submitSellerEvidence(
  input: SubmitSellerEvidenceInput,
  store: EvidenceSubmissionStore,
): Promise<{ event: TransitionEvent; auditId: string }> {
  const slots = new Set(input.items.map((item) => item.slot));
  if (
    input.items.length !== EVIDENCE_PHOTO_SLOTS.length ||
    !EVIDENCE_PHOTO_SLOTS.every((slot) => slots.has(slot))
  ) {
    throw new IncompleteEvidenceError();
  }

  let auditId: string | null = null;

  const event = await transition(
    {
      dealId: input.dealId,
      from: input.from,
      to: "AUDITING",
      actor: "seller",
      payload: {
        title: "Evidence submitted",
        detail: "The seller uploaded photos A, B and C. The audit is running.",
      },
    },
    {
      transition: async (record) => {
        const result = await store.submit(record, input.items);
        auditId = result.auditId;
        return result.event;
      },
    },
  );

  if (!auditId) {
    throw new Error("The evidence submission returned no audit");
  }

  return { event, auditId };
}
