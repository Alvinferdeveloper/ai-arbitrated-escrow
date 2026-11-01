// Product-wide constants. Change the product name here and nowhere else.

export const APP_NAME = "Project Shield";

export const CURRENCY = "USD" as const;
/** Smallest deal PayPal and the payout fees make sensible. */
export const MIN_DEAL_AMOUNT = 1;
/**
 * Sanity ceiling against typos, not a product limit. Large deals are allowed
 * and reviewed by a person (HIGH_VALUE rule). Mirrors the deals CHECK.
 */
export const MAX_DEAL_AMOUNT = 100_000;
export const MAX_DELIVERY_ESTIMATE_DAYS = 14;

export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

/** Time after the delivery estimate before funds auto-release to the seller. */
export const AUTO_RELEASE_GRACE_MS = DEMO_MODE ? 2 * 60 * 1000 : 48 * 60 * 60 * 1000;

/**
 * Length of one delivery-estimate day for the auto-release deadline. Demo mode
 * counts it as zero so a judge sees the release after the 2-minute grace.
 */
export const DELIVERY_DAY_MS = DEMO_MODE ? 0 : 24 * 60 * 60 * 1000;

/** Max AI calls per demo session (NFR9). */
export const AI_CALLS_PER_SESSION = Number(process.env.AI_CALLS_PER_SESSION ?? 20);

/** Images are resized in the browser to this long side before upload. */
export const EVIDENCE_MAX_LONG_SIDE_PX = 1536;
