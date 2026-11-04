const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Short countdown for the Holding Slip. Pure so it can be tested. */
export function formatDeadline(
  deadline: Date,
  now: Date = new Date(),
  label = "Auto-release",
  passed = `${label} deadline passed`,
): string {
  const remaining = deadline.getTime() - now.getTime();

  if (remaining <= 0) return passed;
  if (remaining < MINUTE_MS) return `${label} in under a minute`;

  const days = Math.floor(remaining / DAY_MS);
  const hours = Math.floor((remaining % DAY_MS) / HOUR_MS);
  const minutes = Math.floor((remaining % HOUR_MS) / MINUTE_MS);

  if (days > 0) return `${label} in ${days}d ${hours}h`;
  if (hours > 0) return `${label} in ${hours}h ${minutes}m`;
  return `${label} in ${minutes}m`;
}

/** The countdown the Holding Slip shows: evidence first, then auto-release. */
export function holdingSlipDeadline(
  deal: { evidenceDueAt: Date | null; autoReleaseAt: Date | null },
  now: Date = new Date(),
): string | undefined {
  // Past the deadline the cron acts within minutes; say what happens next.
  if (deal.evidenceDueAt) {
    return formatDeadline(deal.evidenceDueAt, now, "Evidence due", "Evidence deadline passed, refund starting");
  }
  if (deal.autoReleaseAt) {
    return formatDeadline(deal.autoReleaseAt, now, "Auto-release", "Auto-release due, payout starting");
  }
  return undefined;
}
