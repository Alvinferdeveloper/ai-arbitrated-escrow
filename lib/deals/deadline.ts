const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Short countdown for the Holding Slip. Pure so it can be tested. */
export function formatDeadline(deadline: Date, now: Date = new Date()): string {
  const remaining = deadline.getTime() - now.getTime();

  if (remaining <= 0) return "Auto-release deadline passed";
  if (remaining < MINUTE_MS) return "Auto-release in under a minute";

  const days = Math.floor(remaining / DAY_MS);
  const hours = Math.floor((remaining % DAY_MS) / HOUR_MS);
  const minutes = Math.floor((remaining % HOUR_MS) / MINUTE_MS);

  if (days > 0) return `Auto-release in ${days}d ${hours}h`;
  if (hours > 0) return `Auto-release in ${hours}h ${minutes}m`;
  return `Auto-release in ${minutes}m`;
}
