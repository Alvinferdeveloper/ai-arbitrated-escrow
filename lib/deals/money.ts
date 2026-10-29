import { CURRENCY } from "@/lib/config";

// Money is stored in integer cents; only the UI and form inputs speak decimals.

export function formatMoney(cents: number): string {
  return `${(cents / 100).toFixed(2)} ${CURRENCY}`;
}

/** Converts a validated USD string ("37.5", "37.50", "100") to integer cents. */
export function usdToCents(value: string): number {
  const [whole, fraction = ""] = value.trim().split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0").slice(0, 2));
}

/** Formats cents for a text input, always with two decimals. */
export function centsToUsdInput(cents: number): string {
  return (cents / 100).toFixed(2);
}
