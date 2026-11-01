import { describe, expect, it } from "vitest";
import {
  IncompleteEvidenceError,
  submitSellerEvidence,
  type EvidenceItem,
} from "./evidence-submission";
import type { TransitionRecord } from "./transition";

const item = (slot: "A" | "B" | "C"): EvidenceItem => ({
  slot,
  storagePath: `deal/${slot}-1.jpg`,
  sha256: "a".repeat(64),
  mediaType: "image/jpeg",
  sizeBytes: 1000,
  width: 1536,
  height: 1152,
  exif: {},
});

describe("submitSellerEvidence()", () => {
  it("moves the deal to AUDITING as the seller and returns the audit id", async () => {
    const records: TransitionRecord[] = [];

    const result = await submitSellerEvidence(
      {
        dealId: "deal",
        from: "EVIDENCE_REJECTED",
        items: [item("A"), item("B"), item("C")],
      },
      {
        submit: async (record) => {
          records.push(record);
          return { event: { ...record, occurredAt: new Date(0) }, auditId: "audit-1" };
        },
      },
    );

    expect(result.auditId).toBe("audit-1");
    expect(records[0]).toMatchObject({
      from: "EVIDENCE_REJECTED",
      to: "AUDITING",
      actor: "seller",
    });
  });

  it("refuses a submission without all three photos", async () => {
    await expect(
      submitSellerEvidence(
        { dealId: "deal", from: "FUNDS_HELD", items: [item("A"), item("A"), item("C")] },
        {
          submit: async () => {
            throw new Error("must not be called");
          },
        },
      ),
    ).rejects.toBeInstanceOf(IncompleteEvidenceError);
  });
});
