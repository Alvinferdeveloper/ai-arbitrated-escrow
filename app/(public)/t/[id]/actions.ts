"use server";

import { redirect } from "next/navigation";
import { CheckoutUnavailableError } from "@/lib/db/checkout-store";
import { isSupabaseConfigured } from "@/lib/db/server";
import { dealIdSchema } from "@/lib/deals/schema";
import { requestOrigin } from "@/lib/http/origin";
import { startCheckout } from "@/lib/paypal/checkout";
import { isPayPalConfigured } from "@/lib/paypal/config";

// The buyer's "Pay with PayPal" action. The amount is read from the deal row by
// the database function; the form only supplies the deal id.

export type StartCheckoutState = {
  error: string | null;
};

const UNAVAILABLE_MESSAGES: Record<string, string> = {
  deal_not_found: "This deal no longer exists.",
  deal_not_awaiting_payment: "This deal is not waiting for a payment any more.",
  payment_in_progress:
    "PayPal already has a payment in progress for this deal. Reload the page to see its state.",
};

export async function startCheckoutAction(
  _previous: StartCheckoutState,
  formData: FormData,
): Promise<StartCheckoutState> {
  const parsedDeal = dealIdSchema.safeParse(formData.get("dealId"));

  if (!parsedDeal.success) {
    return { error: "The deal link is not valid. Ask the seller for a new one." };
  }

  if (!isSupabaseConfigured()) {
    return {
      error:
        "Payments need Supabase. Add the database credentials to this environment and reload the page.",
    };
  }

  if (!isPayPalConfigured()) {
    return {
      error:
        "PayPal sandbox credentials are not configured. Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.",
    };
  }

  let approvalUrl: string;

  try {
    const origin = await requestOrigin();
    ({ approvalUrl } = await startCheckout({
      dealId: parsedDeal.data,
      origin,
    }));
  } catch (error) {
    if (error instanceof CheckoutUnavailableError) {
      return {
        error:
          UNAVAILABLE_MESSAGES[error.code] ??
          "This deal cannot be paid right now. Nothing was charged.",
      };
    }

    console.error("PayPal checkout could not start", error);

    return {
      error:
        "PayPal did not answer. Nothing was charged; try again in a moment.",
    };
  }

  redirect(approvalUrl);
}
