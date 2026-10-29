import "server-only";
import { requirePayPalConfig } from "./config";
import { paypalRequest } from "./client";
import type { WebhookVerificationInput } from "./webhook-event";

// PayPal signs every delivery and calls this endpoint to verify it. We use
// their own verification endpoint so the app does not have to implement
// signature checking itself.

const REQUIRED_WEBHOOK_HEADERS = [
  "paypal-auth-algo",
  "paypal-cert-url",
  "paypal-transmission-id",
  "paypal-transmission-sig",
  "paypal-transmission-time",
] as const;

export async function verifyWebhookSignature(
  input: WebhookVerificationInput,
): Promise<boolean> {
  const config = requirePayPalConfig();
  const webhookId = config.webhookId;

  if (!webhookId) {
    throw new Error("PayPal webhook verification needs PAYPAL_WEBHOOK_ID.");
  }

  const values = Object.fromEntries(
    REQUIRED_WEBHOOK_HEADERS.map((name) => [name, input.headers.get(name) ?? ""]),
  );

  if (Object.values(values).some((value) => value.trim() === "")) {
    return false;
  }

  const payload = await paypalRequest<{ verification_status?: string }>({
    method: "POST",
    path: "/v1/notifications/verify-webhook-signature",
    body: {
      auth_algo: values["paypal-auth-algo"],
      cert_url: values["paypal-cert-url"],
      transmission_id: values["paypal-transmission-id"],
      transmission_sig: values["paypal-transmission-sig"],
      transmission_time: values["paypal-transmission-time"],
      webhook_id: webhookId,
      webhook_event: input.event,
    },
    config,
  });

  return payload.verification_status === "SUCCESS";
}
