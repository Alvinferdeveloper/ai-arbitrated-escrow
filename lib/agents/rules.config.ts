// Escalation thresholds. Tuned with the eval set in /evals.
// Any rule that fires sends the deal to the human mediator, whatever the model says.

export const ESCALATION_RULES = {
  /** Allowed deviation between the guide weight and the expected product weight. */
  weightTolerance: 0.25,
  /** Guide fields that must be readable, or the "unreadable guide" rule fires. */
  requiredGuideFields: ["carrier", "trackingNumber", "weightKg", "date"] as const,
  /** Audit time budget before it counts as a technical failure. */
  auditTimeoutMs: 60_000,
  /** Deals above this always get a person's review before shipping. */
  highValueReviewAboveCents: 50_000,
  /** Audits stuck in PENDING or RUNNING longer than this are retried by cron. */
  stuckAuditAfterMs: 3 * 60_000,
} as const;

export const ESCALATION_RULE_IDS = [
  "PRODUCT_MISMATCH",
  "WEIGHT_OUT_OF_RANGE",
  "UNREADABLE_GUIDE",
  "CONFLICTING_EVIDENCE",
  "TECHNICAL_FAILURE",
  "OUT_OF_BAND_REVERSAL",
  "HIGH_VALUE",
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
};
