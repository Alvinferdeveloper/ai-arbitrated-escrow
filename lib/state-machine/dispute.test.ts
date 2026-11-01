import { describe, expect, it } from "vitest";
import {
  InvalidUnboxingEvidenceError,
  openDispute,
  submitUnboxingEvidence,
  type DisputeStore,
} from "./dispute";
import type { EvidenceItem } from "./evidence-submission";
import type { TransitionRecord } from "./transition";

const unboxing: EvidenceItem = {
  slot: "D",
  storagePath: "deal/D-1.jpg",
  sha256: "b".repeat(64),
  mediaType: "image/jpeg",
  sizeBytes: 1000,
  width: 1536,
  height: 1152,
  exif: {},
};

function makeStore() {
  const records: TransitionRecord[] = [];
  const reasons: string[] = [];
  const store: DisputeStore = {
    openDispute: async (record, reason) => {
      records.push(record);
      reasons.push(reason);
      return { ...record, occurredAt: new Date(0) };
    },
    submitUnboxing: async (record) => {
      records.push(record);
      return { event: { ...record, occurredAt: new Date(0) }, auditId: "audit-9" };
    },
  };
  return { store, records, reasons };
}

describe("openDispute()", () => {
  it("moves a shipped deal to DISPUTED as the buyer with the claim", async () => {
    const { store, records, reasons } = makeStore();

    await openDispute({ dealId: "deal", reason: "The box was empty." }, store);

    expect(reasons).toEqual(["The box was empty."]);
    expect(records[0]).toMatchObject({
      from: "SHIPPED",
      to: "DISPUTED",
      actor: "buyer",
      payload: { claim: "The box was empty." },
    });
  });
});

describe("submitUnboxingEvidence()", () => {
  it("starts the arbitration and returns the audit id", async () => {
    const { store, records } = makeStore();

    const result = await submitUnboxingEvidence({ dealId: "deal", item: unboxing }, store);

    expect(result.auditId).toBe("audit-9");
    expect(records[0]).toMatchObject({ from: "DISPUTED", to: "ARBITRATING", actor: "buyer" });
  });

  it("refuses any photo other than D", async () => {
    const { store, records } = makeStore();

    await expect(
      submitUnboxingEvidence({ dealId: "deal", item: { ...unboxing, slot: "A" } }, store),
    ).rejects.toBeInstanceOf(InvalidUnboxingEvidenceError);
    expect(records).toHaveLength(0);
  });
});
