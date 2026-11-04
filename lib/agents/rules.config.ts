// Rule thresholds. Tuned with the eval set in /evals. The model reports findings;
// these rules turn them into the decision, whatever the model says.

export const ESCALATION_RULES = {
  /** Allowed deviation between the guide weight and the expected product weight. */
  weightTolerance: 0.25,
  /** Guide fields that must be readable, or the "unreadable guide" rule fires. */
  requiredGuideFields: ["carrier", "trackingNumber", "weightKg", "date"] as const,
  /** Audit time budget before it counts as a technical failure. */
  auditTimeoutMs: 60_000,
  /** Deals above this need a legible serial number or model label in photo A. */
  highValueReviewAboveCents: 50_000,
  /** Extra model calls after an error or invalid output before giving up. */
  technicalRetries: 1,
  /** Rejected uploads after which the buyer is refunded instead of asked again. */
  maxEvidenceAttempts: 3,
  /** Audits stuck in PENDING or RUNNING longer than this are retried by cron. */
  stuckAuditAfterMs: 3 * 60_000,
  /** Slack for time zones and camera clocks when a photo or guide predates the deal. */
  freshnessToleranceMs: 24 * 60 * 60 * 1000,
} as const;

export const ESCALATION_RULE_IDS = [
  "PRODUCT_MISMATCH",
  "WEIGHT_OUT_OF_RANGE",
  "UNREADABLE_GUIDE",
  "CONFLICTING_EVIDENCE",
  "TECHNICAL_FAILURE",
  "OUT_OF_BAND_REVERSAL",
  "HIGH_VALUE",
  "VERIFICATION_CODE",
  "GUIDE_PREDATES_DEAL",
  "TRACKING_FORMAT",
  "REUSED_PHOTO",
  "EDITED_PHOTO",
  "OLD_PHOTO",
] as const;

export type EscalationRuleId = (typeof ESCALATION_RULE_IDS)[number];

/** Plain-language labels for the UI and the mediator queue. */
export const ESCALATION_RULE_LABELS: Record<EscalationRuleId, string> = {
  PRODUCT_MISMATCH: "Product mismatch",
  WEIGHT_OUT_OF_RANGE: "Weight out of range",
  UNREADABLE_GUIDE: "Unreadable guide",
  CONFLICTING_EVIDENCE: "Conflicting evidence",
  TECHNICAL_FAILURE: "Technical failure",
  OUT_OF_BAND_REVERSAL: "Out-of-band reversal",
  HIGH_VALUE: "High-value deal",
  VERIFICATION_CODE: "Verification code missing",
  GUIDE_PREDATES_DEAL: "Guide older than the deal",
  TRACKING_FORMAT: "Tracking number does not fit the carrier",
  REUSED_PHOTO: "Photo used in another deal",
  EDITED_PHOTO: "Edited photo",
  OLD_PHOTO: "Photo taken before the deal",
};
