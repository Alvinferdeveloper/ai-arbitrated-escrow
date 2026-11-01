"use server";

import { redirect } from "next/navigation";
import { CheckoutUnavailableError } from "@/lib/db/checkout-store";
import {
  ReleaseUnavailableError,
  requestRelease,
} from "@/lib/db/release-store";
import { isSupabaseConfigured } from "@/lib/db/server";
import { dealIdSchema } from "@/lib/deals/schema";
import { requestOrigin } from "@/lib/http/origin";
import { startCheckout } from "@/lib/paypal/checkout";
import { isPayPalConfigured } from "@/lib/paypal/config";
import { runPendingSettlement } from "@/lib/paypal/settlement-runner";

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

// FR7: the buyer confirms the parcel arrived. The payout is queued and sent to
// PayPal here; the deal only becomes RELEASED when PayPal's webhook confirms it.

export type ConfirmReceiptState = {
  status: "IDLE" | "QUEUED" | "FAILED";
  message: string | null;
};

const RELEASE_UNAVAILABLE: Record<string, string> = {
  deal_not_found: "This deal no longer exists.",
  deal_not_shipped: "This deal is not waiting for a release.",
  settlement_already_queued:
    "A refund is already being processed for this deal. The mediator will finish it.",
};

export async function confirmReceiptAction(
  _previous: ConfirmReceiptState,
  formData: FormData,
): Promise<ConfirmReceiptState> {
  const parsedDeal = dealIdSchema.safeParse(formData.get("dealId"));

  if (!parsedDeal.success) {
    return { status: "FAILED", message: "The deal link is not valid." };
  }

  if (!isSupabaseConfigured()) {
    return {
      status: "FAILED",
      message:
        "The payout needs Supabase. Add the database credentials and reload the page.",
    };
  }

  try {
    await requestRelease(parsedDeal.data);
    const result = await runPendingSettlement(parsedDeal.data);

    if (result.outcome === "FAILED") {
      console.error("Payout failed", result.reason);
      return {
        status: "FAILED",
        message:
          "The payout was queued but PayPal refused it. Nothing was sent to the seller; ask the mediator to retry it.",
      };
    }

    if (result.outcome === "SKIPPED" && result.reason === "PAYPAL_NOT_CONFIGURED") {
      return {
        status: "QUEUED",
        message:
          "The payout is queued. PayPal is not configured in this environment, so it will be sent once the sandbox credentials are added.",
      };
    }

    if (
      result.outcome === "SKIPPED" &&
      result.reason !== "ALREADY_SUBMITTED"
    ) {
      return {
        status: "FAILED",
        message:
          "The payout could not be prepared. Nothing moved; reload the page and try again.",
      };
    }

    return {
      status: "QUEUED",
      message:
        "The payout was submitted to PayPal. The deal becomes released when PayPal confirms the transfer.",
    };
  } catch (error) {
    if (error instanceof ReleaseUnavailableError) {
      return {
        status: "FAILED",
        message:
          RELEASE_UNAVAILABLE[error.code] ??
          "This deal cannot be released right now. Nothing moved.",
      };
    }

    console.error("Confirm receipt failed", error);

    return {
      status: "FAILED",
      message:
        "The payout could not be submitted. Nothing moved; try again in a moment.",
    };
  }
}
