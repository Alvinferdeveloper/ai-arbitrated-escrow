// Product-wide constants. Change the product name here and nowhere else.

export const APP_NAME = "Project Shield";

export const CURRENCY = "USD" as const;
/** Smallest deal PayPal and the payout fees make sensible. */
export const MIN_DEAL_AMOUNT = 1;
/** Typo guard, not a product limit. Mirrors the deals CHECK. */
export const MAX_DEAL_AMOUNT = 100_000;
export const MAX_DELIVERY_ESTIMATE_DAYS = 14;

export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

/** Time after the delivery estimate before funds auto-release to the seller. */
export const AUTO_RELEASE_GRACE_MS = DEMO_MODE ? 2 * 60 * 1000 : 48 * 60 * 60 * 1000;

/** Time the seller has to upload valid evidence before the buyer is refunded. */
export const EVIDENCE_DEADLINE_MS = DEMO_MODE ? 3 * 60 * 1000 : 3 * 24 * 60 * 60 * 1000;

/** Zero in demo mode, so auto-release happens after the grace period alone. */
export const DELIVERY_DAY_MS = DEMO_MODE ? 0 : 24 * 60 * 60 * 1000;

/** Max AI calls per demo session (NFR9). */
export const AI_CALLS_PER_SESSION = Number(process.env.AI_CALLS_PER_SESSION ?? 20);

/** Images are resized in the browser to this long side before upload. */
export const EVIDENCE_MAX_LONG_SIDE_PX = 1536;

/** Mirrors the evidence bucket limit. */
export const EVIDENCE_MAX_BYTES = 10 * 1024 * 1024;
