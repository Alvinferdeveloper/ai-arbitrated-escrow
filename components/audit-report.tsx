import { CircleCheck, CircleMinus, Flag, ShieldX, TriangleAlert } from "lucide-react";
import {
  ESCALATION_RULE_LABELS,
  type EscalationRuleId,
} from "@/lib/agents/rules.config";
import type {
  AuditCheckResult,
  AuditReportView,
} from "@/lib/deals/types";

const CHECK_ICONS = {
  cleared: CircleCheck,
  blocked: ShieldX,
  flagged: Flag,
  skipped: CircleMinus,
} as const;

const CHECK_TONES: Record<AuditCheckResult, string> = {
  cleared: "text-cleared",
  blocked: "text-blocked",
  flagged: "text-flagged",
  skipped: "text-ink-muted",
};

function ruleLabel(rule: string): string {
  return ESCALATION_RULE_LABELS[rule as EscalationRuleId] ?? rule;
}

function summarize(audit: AuditReportView): string {
  const problems = audit.checks.filter(
    (check) => check.result === "blocked" || check.result === "flagged",
  );
  if (problems.length === 0) {
    const passed = audit.checks.filter((check) => check.result === "cleared").length;
    return `All ${passed} checks passed.`;
  }
  const names = problems.map((check) => check.label).join(", ");
  return problems.length === 1
    ? `1 check did not pass: ${names}.`
    : `${problems.length} checks did not pass: ${names}.`;
}

export function AuditReport({ audit }: { audit: AuditReportView }) {
  const hasProblems = audit.checks.some(
    (check) => check.result === "blocked" || check.result === "flagged",
  );

  return (
    <section aria-labelledby="audit-heading" className="space-y-5">
      <div>
        <h2
          id="audit-heading"
          className="text-[1.125rem] font-semibold leading-[1.35] text-ink"
        >
          Audit report
        </h2>
        <p className="mt-1 max-w-[65ch] text-[0.9375rem] leading-[1.55] text-ink-muted">
          Written from the three photos, the shipping guide and the fraud checks. The
          rules, not a score, decide what happens next.
        </p>
        <p
          className={`mt-3 text-[1rem] font-medium leading-[1.55] ${hasProblems ? "text-blocked" : "text-cleared"}`}
        >
          {summarize(audit)}
        </p>
      </div>

      <ul className="divide-y divide-rule-line border-y border-rule-line">
        {audit.checks.map((check) => {
          const Icon = CHECK_ICONS[check.result];
          return (
            <li key={check.id} className="flex gap-3 py-3">
              <Icon
                aria-hidden="true"
                size={18}
                strokeWidth={1.75}
                className={`mt-0.5 shrink-0 ${CHECK_TONES[check.result]}`}
              />
              <div>
                <p className="text-[0.9375rem] font-medium text-ink">{check.label}</p>
                <p className="mt-1 text-[0.875rem] leading-[1.55] text-ink-muted">
                  {check.detail}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      {audit.guide ? (
        <div className="rounded-md border border-rule-line bg-kraft p-4">
          <h3 className="text-[0.8125rem] font-medium text-ink-muted">
            Data read from the guide
          </h3>
          <dl className="mt-3 grid grid-cols-[7rem_1fr] gap-x-4 gap-y-2">
            <dt className="text-[0.8125rem] text-ink-muted">Carrier</dt>
            <dd className="font-mono text-[0.875rem] tabular-nums text-ink">
              {audit.guide.carrier}
            </dd>
            <dt className="text-[0.8125rem] text-ink-muted">Tracking</dt>
            <dd className="font-mono text-[0.875rem] tabular-nums text-ink">
              {audit.guide.trackingNumber}
            </dd>
            <dt className="text-[0.8125rem] text-ink-muted">Weight</dt>
            <dd className="font-mono text-[0.875rem] tabular-nums text-ink">
              {audit.guide.weightKg}
            </dd>
            <dt className="text-[0.8125rem] text-ink-muted">Date</dt>
            <dd className="font-mono text-[0.875rem] tabular-nums text-ink">
              {audit.guide.date}
            </dd>
          </dl>
        </div>
      ) : null}

      {audit.inconsistencies.length > 0 ? (
        <div>
          <h3 className="text-[0.8125rem] font-medium text-ink-muted">Inconsistencies</h3>
          <ul className="mt-2 space-y-2">
            {audit.inconsistencies.map((text) => (
              <li key={text} className="flex gap-2 text-[0.9375rem] leading-[1.55] text-ink">
                <TriangleAlert
                  aria-hidden="true"
                  size={18}
                  strokeWidth={1.75}
                  className="mt-0.5 shrink-0 text-flagged"
                />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <h3 className="text-[0.8125rem] font-medium text-ink-muted">
          Rules that fired
        </h3>
        {audit.triggeredRules.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-2">
            {audit.triggeredRules.map((rule) => (
              <li
                key={rule}
                className="inline-flex items-center gap-1.5 rounded-sm border border-flagged bg-flagged-wash px-2 py-1 text-[0.8125rem] font-medium leading-none text-flagged"
              >
                <Flag aria-hidden="true" size={16} strokeWidth={1.75} />
                {ruleLabel(rule)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[0.9375rem] text-ink-muted">
            No rule fired.
          </p>
        )}
      </div>
    </section>
  );
}
