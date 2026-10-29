import "server-only";

// PayPal access lives inside this module. Only the server reads these values,
// so the browser never sees client secrets or webhook ids.

export type PayPalConfig = {
  clientId: string;
  clientSecret: string;
  environment: "SANDBOX";
  webhookId: string | null;
  baseUrl: string;
};

export function isPayPalConfigured(): boolean {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  const environment = process.env.PAYPAL_ENVIRONMENT?.trim().toUpperCase();

  return Boolean(clientId && clientSecret && (!environment || environment === "SANDBOX"));
}

export function isPayPalWebhookConfigured(): boolean {
  return Boolean(process.env.PAYPAL_WEBHOOK_ID?.trim());
}

export function requirePayPalConfig(): PayPalConfig {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  const environment = process.env.PAYPAL_ENVIRONMENT?.trim().toUpperCase();

  if (!clientId || !clientSecret) {
    throw new Error(
      "PayPal is not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.",
    );
  }

  if (environment && environment !== "SANDBOX") {
    throw new Error("Only the PayPal SANDBOX environment is supported.");
  }

  const webhookId = process.env.PAYPAL_WEBHOOK_ID?.trim() || null;

  return {
    clientId,
    clientSecret,
    environment: "SANDBOX",
    webhookId,
    baseUrl: "https://api-m.sandbox.paypal.com",
  };
}
