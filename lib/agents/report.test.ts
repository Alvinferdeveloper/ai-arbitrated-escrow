import { describe, expect, it } from "vitest";
import { toAuditReportView } from "./report";
import type { EvidenceAudit } from "./schemas";

const honestAudit: EvidenceAudit = {
  product: {
    matchesListing: true,
    differentItem: false,
    identifierVisible: false,
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
    dateIso: "2026-10-28",
  },
  verification: { codeInPhotoA: null, codeInPhotoC: null },
  inconsistencies: [],
};

describe("toAuditReportView", () => {
  it("writes a complete report for an honest audit", () => {
    const report = toAuditReportView(honestAudit, []);

    expect(report.checks.every((check) => check.result === "cleared")).toBe(true);
    expect(report.checks.map((check) => check.id)).toEqual([
      "product",
      "packing",
      "parcel",
      "guide",
      "weight",
      "original",
      "guide-date",
      "tracking-format",
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
          dateIso: null,
        },
      },
      ["UNREADABLE_GUIDE"],
    );

    expect(report.guide).toBeNull();
    expect(report.checks.find((check) => check.id === "guide")?.result).toBe("blocked");
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

  it("shows the verification code check only when the deal has a code", () => {
    const cleared = toAuditReportView(honestAudit, [], { verificationCode: "K7P4", isSample: false });
    expect(cleared.checks.find((check) => check.id === "code")).toMatchObject({
      result: "cleared",
    });

    const blocked = toAuditReportView(honestAudit, ["VERIFICATION_CODE"], {
      verificationCode: "K7P4",
      isSample: false,
    });
    expect(blocked.checks.find((check) => check.id === "code")?.result).toBe("blocked");
  });

  it("flags the photo and guide checks from their rules", () => {
    const report = toAuditReportView(honestAudit, ["REUSED_PHOTO", "GUIDE_PREDATES_DEAL"]);
    expect(report.checks.find((check) => check.id === "original")).toMatchObject({
      result: "flagged",
      detail: "Photo used in another deal.",
    });
    expect(report.checks.find((check) => check.id === "guide-date")?.result).toBe("flagged");
  });

  it("says freshness was not checked on sample deals", () => {
    const report = toAuditReportView(honestAudit, [], { verificationCode: "K7P4", isSample: true });
    expect(report.checks.find((check) => check.id === "original")?.result).toBe("skipped");
    expect(report.checks.find((check) => check.id === "guide-date")?.result).toBe("skipped");
  });

  it("shows a fired weight rule as a blocked row at the top", () => {
    const report = toAuditReportView(
      { ...honestAudit, guide: { ...honestAudit.guide, weightKg: 0.4 } },
      ["WEIGHT_OUT_OF_RANGE"],
    );
    expect(report.checks[0]).toMatchObject({
      id: "weight",
      result: "blocked",
      detail: "The guide records 0.4 kg; this product weighs about 1.4 kg packed.",
    });
  });

  it("adds a serial number row only when the high-value rule fired", () => {
    expect(toAuditReportView(honestAudit, []).checks.some((c) => c.id === "serial")).toBe(false);
    expect(toAuditReportView(honestAudit, ["HIGH_VALUE"]).checks[0]).toMatchObject({
      id: "serial",
      result: "blocked",
    });
  });

  it("marks checks that could not run as skipped, after the others", () => {
    const report = toAuditReportView(
      { ...honestAudit, guide: { ...honestAudit.guide, carrier: "Cargo Expreso", dateIso: null } },
      [],
    );
    const ids = report.checks.map((check) => check.id);
    expect(ids.slice(-2)).toEqual(["guide-date", "tracking-format"]);
    expect(report.checks.at(-1)?.result).toBe("skipped");
  });
});
