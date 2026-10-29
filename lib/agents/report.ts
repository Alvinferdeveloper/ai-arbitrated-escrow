import type {
  AuditCheck,
  AuditCheckResult,
  AuditReportView,
  GuideData,
} from "@/lib/deals/types";
import { missingGuideFields } from "./rules";
import type { EvidenceAudit } from "./schemas";

// Maps the validated model output to the read model the screens already use.
// The rules stay in rules.ts; this file only writes the record shown to people.

function check(
  id: string,
  label: string,
  result: AuditCheckResult,
  detail: string,
): AuditCheck {
  return { id, label, result, detail };
}

function readGuide(guide: EvidenceAudit["guide"]): GuideData | null {
  const { readable, carrier, trackingNumber, weightKg, date } = guide;
  if (
    !readable ||
    carrier === null ||
    trackingNumber === null ||
    weightKg === null ||
    date === null
  ) {
    return null;
  }

  return { carrier, trackingNumber, weightKg: `${weightKg} kg`, date };
}

export function toAuditReportView(
  audit: EvidenceAudit,
  triggeredRules: readonly string[],
): AuditReportView {
  const guide = readGuide(audit.guide);
  const guideComplete = guide !== null;

  const guideDetail = guideComplete
    ? "Carrier, tracking number, weight and date are all legible."
    : missingGuideFields(audit.guide).length > 0
      ? "A required field on the guide is missing or unreadable."
      : "The guide is not fully legible.";

  return {
    checks: [
      check(
        "product",
        "Product matches the listing",
        audit.product.matchesListing ? "cleared" : "blocked",
        audit.product.reason,
      ),
      check(
        "packing",
        "Product is inside the packing",
        audit.packing.productInside ? "cleared" : "blocked",
        audit.packing.reason,
      ),
      check(
        "parcel",
        "Parcel is sealed with a legible guide",
        audit.parcel.sealed && audit.parcel.guideVisible ? "cleared" : "blocked",
        audit.parcel.reason,
      ),
      check(
        "guide",
        "Guide data is readable",
        guideComplete ? "cleared" : "flagged",
        guideDetail,
      ),
    ],
    guide,
    inconsistencies: [...audit.inconsistencies],
    triggeredRules: [...triggeredRules],
  };
}
