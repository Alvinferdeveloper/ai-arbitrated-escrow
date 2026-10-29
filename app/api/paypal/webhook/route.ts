import { after } from "next/server";
import { isPayPalConfigured } from "@/lib/paypal/config";
import { verifyWebhookSignature } from "@/lib/paypal/webhook-verification";
import { processPayPalWebhook } from "@/lib/db/paypal-webhook";

// PayPal calls here. We verify the signature first, then reply 200 and do the
// bookkeeping afterwards so PayPal never waits on Supabase or the model.

export const maxDuration = 30;

export async function POST(request: Request) {
  const raw = await request.text();

  let event: unknown;
  try {
    event = JSON.parse(raw);
  } catch {
    return Response.json({ received: false, error: "invalid_json" }, { status: 400 });
  }

  if (!isPayPalConfigured()) {
    return Response.json({ received: false, error: "paypal_not_configured" }, { status: 503 });
  }

  try {
    const verified = await verifyWebhookSignature({ headers: request.headers, event });
    if (!verified) {
      return Response.json({ received: false, error: "invalid_signature" }, { status: 400 });
    }
  } catch (error) {
    console.error("PayPal webhook verification failed", error);
    return Response.json({ received: false, error: "verification_failed" }, { status: 503 });
  }

  after(async () => {
    try {
      await processPayPalWebhook(event);
    } catch (error) {
      console.error("PayPal webhook processing failed", error);
    }
  });

  return Response.json({ received: true });
}
