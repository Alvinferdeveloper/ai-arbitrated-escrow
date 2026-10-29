import { describe, expect, it } from "vitest";
import { toAuditReportView } from "./report";
import type { EvidenceAudit } from "./schemas";

const honestAudit: EvidenceAudit = {
  product: {
    matchesListing: true,
    expectedWeightKg: 1.4,
    reason: "The black headphones match the listing.",
  },
  packing: {
    productInside: true,
    reason: "The headphones are inside the box.",
  },
  parcel: {
    sealed: true,
    guideVisible: true,
    reason: "The parcel is sealed and the guide is visible.",
  },
  guide: {
    readable: true,
    carrier: "UPS",
    trackingNumber: "1Z999AA10123456784",
    weightKg: 1.4,
    date: "2026-10-28",
  },
  inconsistencies: [],
};

describe("toAuditReportView", () => {
  it("writes a complete report for an honest audit", () => {
    const report = toAuditReportView(honestAudit, []);

    expect(report.checks.map((check) => check.result)).toEqual([
      "cleared",
      "cleared",
      "cleared",
      "cleared",
    ]);
    expect(report.guide).toEqual({
      carrier: "UPS",
      trackingNumber: "1Z999AA10123456784",
      weightKg: "1.4 kg",
      date: "2026-10-28",
    });
    expect(report.inconsistencies).toEqual([]);
    expect(report.triggeredRules).toEqual([]);
  });

  it("keeps the triggered rules from the decision", () => {
    const report = toAuditReportView(honestAudit, ["WEIGHT_OUT_OF_RANGE"]);
    expect(report.triggeredRules).toEqual(["WEIGHT_OUT_OF_RANGE"]);
  });

  it("hides incomplete guide data and flags the guide check", () => {
    const report = toAuditReportView(
      {
        ...honestAudit,
        guide: {
          readable: false,
          carrier: null,
          trackingNumber: null,
          weightKg: null,
          date: null,
        },
      },
      ["UNREADABLE_GUIDE"],
    );

    expect(report.guide).toBeNull();
    expect(report.checks.find((check) => check.id === "guide")?.result).toBe("flagged");
  });

  it("marks a missing packing photo as blocked", () => {
    const report = toAuditReportView(
      {
        ...honestAudit,
        packing: { productInside: false, reason: "Photo B shows an empty box." },
      },
      [],
    );

    expect(report.checks.find((check) => check.id === "packing")?.result).toBe(
      "blocked",
    );
  });
});
