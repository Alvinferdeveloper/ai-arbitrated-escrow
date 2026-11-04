// Payload for Orders v2 "add tracking" (POST /v2/checkout/orders/{id}/track).
// Kept free of fetch so the shapes can be tested without the network.

const FIELD_MAX = 64;

// Guide text (normalized to A-Z0-9) to PayPal's shipment_carrier enum. Anything
// else is sent as OTHER with the name the guide shows.
const CARRIER_ALIASES: Record<string, string> = {
  UPS: "UPS",
  UNITEDPARCELSERVICE: "UPS",
  FEDEX: "FEDEX",
  FEDERALEXPRESS: "FEDEX",
  DHL: "DHL",
  DHLEXPRESS: "DHL",
  DHLGLOBAL: "DHL",
  USPS: "USPS",
  UNITEDSTATESPOSTALSERVICE: "USPS",
  CORREODEGUATEMALA: "CORREO_DE_GUATEMALA",
  CORREOELSALVADOR: "CORREO_EL_SALVADOR",
  CORREOSDEHONDURAS: "CORREOS_DE_HONDURAS",
  CORREOSPANAMA: "CORREOS_PANAMA",
  CORREOSDEPANAMA: "CORREOS_PANAMA",
  CORREOSECUADOR: "CORREOS_ECUADOR",
  CORREOSDEECUADOR: "CORREOS_ECUADOR",
  SERVIENTREGA: "SERVIENTREGA",
};

export type PayPalCarrier =
  | { carrier: string }
  | { carrier: "OTHER"; carrier_name_other: string };

export function resolveCarrier(name: string): PayPalCarrier {
  const trimmed = name.trim();
  const key = trimmed.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const known = CARRIER_ALIASES[key];

  return known
    ? { carrier: known }
    : { carrier: "OTHER", carrier_name_other: trimmed.slice(0, FIELD_MAX) };
}

export type TrackerInput = {
  captureId: string;
  carrier: string;
  trackingNumber: string;
};

export class InvalidTrackerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTrackerError";
  }
}

export function buildTracker(input: TrackerInput): Record<string, unknown> {
  const carrier = input.carrier.trim();
  const trackingNumber = input.trackingNumber.trim();

  if (!input.captureId.trim()) throw new InvalidTrackerError("The deal has no PayPal capture.");
  if (!carrier) throw new InvalidTrackerError("The guide has no carrier.");
  if (!trackingNumber || trackingNumber.length > FIELD_MAX) {
    throw new InvalidTrackerError("The tracking number is missing or longer than 64 characters.");
  }

  return {
    capture_id: input.captureId.trim(),
    tracking_number: trackingNumber,
    notify_payer: true,
    ...resolveCarrier(carrier),
  };
}

type TrackedOrder = {
  purchase_units?: { shipping?: { trackers?: { id?: string }[] } }[];
};

/** The newest tracker id PayPal returns for the order, if any. */
export function trackerId(order: unknown): string | null {
  const trackers = (order as TrackedOrder | null)?.purchase_units?.[0]?.shipping?.trackers;
  return trackers?.at(-1)?.id ?? null;
}
