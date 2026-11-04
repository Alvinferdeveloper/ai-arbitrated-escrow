import type {
  AuditCheck,
  AuditCheckResult,
  AuditReportView,
  GuideData,
} from "@/lib/deals/types";
import { missingGuideFields } from "./rules";
import { ESCALATION_RULE_LABELS, type EscalationRuleId } from "./rules.config";
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

export type TrustCheckContext = {
  verificationCode: string | null;
  isSample: boolean;
};

const ORIGINAL_PHOTO_RULES: EscalationRuleId[] = ["REUSED_PHOTO", "EDITED_PHOTO", "OLD_PHOTO"];
const SAMPLE_SKIP = "Not checked: the sample photos were taken before this deal existed.";

function trustChecks(
  audit: EvidenceAudit,
  fired: (rule: EscalationRuleId) => boolean,
  { verificationCode, isSample }: TrustCheckContext,
): AuditCheck[] {
  const checks: AuditCheck[] = [];

  if (verificationCode) {
    checks.push(
      fired("VERIFICATION_CODE")
        ? check("code", "Verification code in photos A and C", "blocked",
            `The handwritten code ${verificationCode} is missing or does not match in photo A or C.`)
        : check("code", "Verification code in photos A and C", "cleared",
            `The handwritten code ${verificationCode} appears in both photos, so they were taken for this deal.`),
    );
  }

  const photoRules = ORIGINAL_PHOTO_RULES.filter(fired);
  checks.push(
    isSample
      ? check("original", "Photos are original", "skipped", SAMPLE_SKIP)
      : photoRules.length > 0
        ? check("original", "Photos are original", "flagged",
            `${photoRules.map((rule) => ESCALATION_RULE_LABELS[rule]).join(", ")}.`)
        : check("original", "Photos are original", "cleared",
            "No photo was used in another deal, edited, or taken before the deal opened."),
  );

  checks.push(
    isSample
      ? check("guide-date", "Guide is newer than the deal", "skipped", SAMPLE_SKIP)
      : fired("GUIDE_PREDATES_DEAL")
        ? check("guide-date", "Guide is newer than the deal", "flagged",
            `The guide is dated ${audit.guide.date ?? "before the deal"}, before this deal was opened.`)
        : check("guide-date", "Guide is newer than the deal", "cleared",
            audit.guide.dateIso
              ? "The guide was printed after the deal was opened."
              : "The guide date could not be compared, so it does not count against the seller."),
  );

  checks.push(
    fired("TRACKING_FORMAT")
      ? check("tracking-format", "Tracking number fits the carrier", "flagged",
          `${audit.guide.trackingNumber ?? "The number"} does not follow the format ${audit.guide.carrier ?? "the carrier"} uses.`)
      : check("tracking-format", "Tracking number fits the carrier", "cleared",
          "The number follows the carrier's format, or the carrier has no public format."),
  );

  return checks;
}

export function toAuditReportView(
  audit: EvidenceAudit,
  triggeredRules: readonly string[],
  trust: TrustCheckContext = { verificationCode: null, isSample: false },
): AuditReportView {
  const fired = (rule: EscalationRuleId) => triggeredRules.includes(rule);
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
      ...trustChecks(audit, fired, trust),
    ],
    guide,
    inconsistencies: [...audit.inconsistencies],
    triggeredRules: [...triggeredRules],
  };
}
