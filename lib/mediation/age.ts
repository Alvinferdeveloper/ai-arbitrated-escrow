const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Short case age for the mediator queue: "8m", "4h", "1d 4h". */
export function formatCaseAge(openedAt: Date, now: Date = new Date()): string {
  const elapsed = Math.max(0, now.getTime() - openedAt.getTime());
  const minutes = Math.floor(elapsed / MINUTE_MS);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(elapsed / HOUR_MS);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(elapsed / DAY_MS);
  return `${days}d ${hours % 24}h`;
}

/** Timestamp for the case timeline, always in UTC so the demo is stable. */
export function formatCaseTimestamp(at: Date): string {
  const formatted = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(at);

  return `${formatted} UTC`;
}
