import { APP_NAME, CURRENCY } from "@/lib/config";

// Payloads and response helpers for PayPal Orders v2. Kept free of fetch and
// database access so the shapes can be tested without the network.

export type PayPalLink = {
  href: string;
  rel: string;
  method?: string;
};

export type PayPalOrder = {
  id?: string;
  status?: string;
  links?: PayPalLink[];
  purchase_units?: {
    payments?: {
      captures?: {
        id?: string;
        status?: string;
      }[];
    };
  }[];
};

export type CreateOrderInput = {
  dealId: string;
  title: string;
  amountCents: number;
  returnUrl: string;
  cancelUrl: string;
};

const DESCRIPTION_MAX = 127;
const INVOICE_MAX = 127;

function amountValue(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function buildCaptureOrder(input: CreateOrderInput): Record<string, unknown> {
  const reference = `shield-${input.dealId}`;

  return {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: input.dealId,
        custom_id: input.dealId,
        invoice_id: reference.slice(0, INVOICE_MAX),
        description: input.title.trim().slice(0, DESCRIPTION_MAX),
        amount: {
          currency_code: CURRENCY,
          value: amountValue(input.amountCents),
        },
      },
    ],
    payment_source: {
      paypal: {
        experience_context: {
          brand_name: APP_NAME,
          locale: "en-US",
          shipping_preference: "NO_SHIPPING",
          user_action: "PAY_NOW",
          return_url: input.returnUrl,
          cancel_url: input.cancelUrl,
        },
      },
    },
  };
}

/** The URL the buyer must visit to approve the order. */
export function approvalUrl(order: PayPalOrder): string | null {
  const links = order.links ?? [];
  const approve =
    links.find((link) => link.rel === "approve") ??
    links.find((link) => link.rel === "payer-action");

  return approve?.href ?? null;
}

/** Capture id from a capture response, if PayPal already confirms the money. */
export function capturedId(order: PayPalOrder): string | null {
  return order.purchase_units?.[0]?.payments?.captures?.[0]?.id ?? null;
}
