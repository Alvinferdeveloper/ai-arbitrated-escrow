import type {
  AuditCheck,
  AuditCheckResult,
  AuditReportView,
  GuideData,
} from "@/lib/deals/types";
import { hasTrackingFormat } from "./fraud-signals";
import { missingGuideFields } from "./rules";
import { ESCALATION_RULE_LABELS, type EscalationRuleId } from "./rules.config";
import type { EvidenceAudit } from "./schemas";

// Maps the validated model output and the rules that fired to the record shown
// to people. Every rule that can fire has a row, so the record never reads
// "all clear" next to a rejection. The rules stay in rules.ts.

export type TrustCheckContext = {
  verificationCode: string | null;
  isSample: boolean;
};

const ORIGINAL_PHOTO_RULES: EscalationRuleId[] = ["REUSED_PHOTO", "EDITED_PHOTO", "OLD_PHOTO"];
const SAMPLE_SKIP = "Not checked: the sample photos were taken before this deal existed.";

/** Problems first, then what passed, then what could not be checked. */
const RESULT_ORDER: Record<AuditCheckResult, number> = {
  blocked: 0,
  flagged: 1,
  cleared: 2,
  skipped: 3,
};

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

function evidenceChecks(
  audit: EvidenceAudit,
  fired: (rule: EscalationRuleId) => boolean,
): AuditCheck[] {
  const { product, packing, parcel, guide } = audit;
  const guideComplete = readGuide(guide) !== null;
  const checks = [
    check(
      "product",
      "Product matches the listing",
      product.matchesListing ? "cleared" : "blocked",
      product.reason,
    ),
  ];

  if (fired("HIGH_VALUE")) {
    checks.push(
      check(
        "serial",
        "Serial number is legible",
        "blocked",
        "This deal is high value, so photo A must show the serial number or model label clearly.",
      ),
    );
  }

  checks.push(
    check(
      "packing",
      "Product is inside the packing",
      packing.productInside ? "cleared" : "blocked",
      packing.reason,
    ),
    check(
      "parcel",
      "Parcel is sealed with a legible guide",
      parcel.sealed && parcel.guideVisible ? "cleared" : "blocked",
      parcel.reason,
    ),
    check(
      "guide",
      "Guide data is readable",
      guideComplete ? "cleared" : "blocked",
      guideComplete
        ? "Carrier, tracking number, weight and date are all legible."
        : missingGuideFields(guide).length > 0
          ? "A required field on the guide is missing or unreadable."
          : "The guide is not fully legible.",
    ),
  );

  const expected = `about ${product.expectedWeightKg} kg packed`;
  checks.push(
    guide.weightKg === null
      ? check("weight", "Weight fits the product", "skipped", "The guide shows no weight to compare.")
      : fired("WEIGHT_OUT_OF_RANGE")
        ? check(
            "weight",
            "Weight fits the product",
            "blocked",
            `The guide records ${guide.weightKg} kg; this product weighs ${expected}.`,
          )
        : check(
            "weight",
            "Weight fits the product",
            "cleared",
            `The guide records ${guide.weightKg} kg; this product weighs ${expected}.`,
          ),
  );

  return checks;
}

function trustChecks(
  audit: EvidenceAudit,
  fired: (rule: EscalationRuleId) => boolean,
  { verificationCode, isSample }: TrustCheckContext,
): AuditCheck[] {
  const { guide } = audit;
  const checks: AuditCheck[] = [];

  if (verificationCode) {
    checks.push(
      fired("VERIFICATION_CODE")
        ? check(
            "code",
            "Verification code in photos A and C",
            "blocked",
            `The handwritten code ${verificationCode} is missing or does not match in photo A or C.`,
          )
        : check(
            "code",
            "Verification code in photos A and C",
            "cleared",
            `The handwritten code ${verificationCode} appears in both photos, so they were taken for this deal.`,
          ),
    );
  }

  const photoRules = ORIGINAL_PHOTO_RULES.filter(fired);
  checks.push(
    isSample
      ? check("original", "Photos are original", "skipped", SAMPLE_SKIP)
      : photoRules.length > 0
        ? check(
            "original",
            "Photos are original",
            "flagged",
            `${photoRules.map((rule) => ESCALATION_RULE_LABELS[rule]).join(", ")}.`,
          )
        : check(
            "original",
            "Photos are original",
            "cleared",
            "No photo was used in another deal, edited, or taken before the deal opened.",
          ),
  );

  checks.push(
    isSample
      ? check("guide-date", "Guide is newer than the deal", "skipped", SAMPLE_SKIP)
      : fired("GUIDE_PREDATES_DEAL")
        ? check(
            "guide-date",
            "Guide is newer than the deal",
            "flagged",
            `The guide is dated ${guide.date ?? "before the deal"}, before this deal was opened.`,
          )
        : guide.dateIso
          ? check(
              "guide-date",
              "Guide is newer than the deal",
              "cleared",
              "The guide was printed after the deal was opened.",
            )
          : check(
              "guide-date",
              "Guide is newer than the deal",
              "skipped",
              "The guide date is missing or ambiguous, so it was not compared.",
            ),
  );

  checks.push(
    fired("TRACKING_FORMAT")
      ? check(
          "tracking-format",
          "Tracking number fits the carrier",
          "flagged",
          `${guide.trackingNumber ?? "The number"} does not follow the format ${guide.carrier ?? "the carrier"} uses.`,
        )
      : hasTrackingFormat(guide.carrier)
        ? check(
            "tracking-format",
            "Tracking number fits the carrier",
            "cleared",
            `The number follows the format ${guide.carrier} uses.`,
          )
        : check(
            "tracking-format",
            "Tracking number fits the carrier",
            "skipped",
            "This carrier has no public format to compare against.",
          ),
  );

  return checks;
}

export function toAuditReportView(
  audit: EvidenceAudit,
  triggeredRules: readonly string[],
  trust: TrustCheckContext = { verificationCode: null, isSample: false },
): AuditReportView {
  const fired = (rule: EscalationRuleId) => triggeredRules.includes(rule);
  const checks = [...evidenceChecks(audit, fired), ...trustChecks(audit, fired, trust)];

  return {
    checks: checks.sort((a, b) => RESULT_ORDER[a.result] - RESULT_ORDER[b.result]),
    guide: readGuide(audit.guide),
    inconsistencies: [...audit.inconsistencies],
    triggeredRules: [...triggeredRules],
  };
}
