import "server-only";
import { requirePayPalConfig, type PayPalConfig } from "./config";

// Thin REST client. OAuth tokens are cached for the lifetime of the server
// instance, and every mutating call accepts a caller-supplied
// PayPal-Request-Id so retries reuse PayPal's own idempotency.

type OAuthTokenResponse = {
  access_token: string;
  expires_in: number;
};

type TokenCache = {
  token: string;
  expiresAt: number;
};

let tokenCache: TokenCache | null = null;

const REQUEST_TIMEOUT_MS = 15_000;

export class PayPalApiError extends Error {
  constructor(
    readonly status: number,
    readonly detail: string,
  ) {
    super(`PayPal request failed with ${status}: ${detail}`);
    this.name = "PayPalApiError";
  }
}

export type PayPalRequestInput = {
  method: "GET" | "POST";
  path: string;
  /// Optional; PayPal treats this as the request idempotency key.
  requestId?: string;
  body?: unknown;
  config?: PayPalConfig;
};

function describeProblem(value: unknown, status: number): string {
  if (value && typeof value === "object") {
    const body = value as { message?: unknown; name?: unknown };
    const message =
      typeof body.message === "string" ? body.message : null;
    const name = typeof body.name === "string" ? body.name : null;
    if (message || name) {
      return `PayPal ${status}: ${message ?? name}`;
    }
  }
  if (typeof value === "string" && value.trim()) {
    return `PayPal ${status}: ${value}`;
  }
  return `PayPal request failed with status ${status}`;
}

async function accessToken(config: PayPalConfig): Promise<string> {
  const now = Date.now();

  if (tokenCache && tokenCache.expiresAt > now) {
    return tokenCache.token;
  }

  const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
  const response = await fetch(`${config.baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const detail = describeProblem(await response.json().catch(() => null), response.status);
    tokenCache = null;
    throw new PayPalApiError(response.status, detail);
  }

  const payload = (await response.json()) as OAuthTokenResponse;
  tokenCache = {
    token: payload.access_token,
    expiresAt: Date.now() + Math.max(payload.expires_in - 60, 0) * 1000,
  };

  return tokenCache.token;
}

export async function paypalRequest<Response>(input: PayPalRequestInput): Promise<Response> {
  const config = input.config ?? requirePayPalConfig();
  const token = await accessToken(config);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  if (input.requestId) {
    headers["PayPal-Request-Id"] = input.requestId;
  }

  const response = await fetch(`${config.baseUrl}${input.path}`, {
    method: input.method,
    headers,
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    tokenCache = response.status === 401 ? null : tokenCache;
    const payload = await response.json().catch(() => null);
    throw new PayPalApiError(response.status, describeProblem(payload, response.status));
  }

  if (response.status === 204) {
    return undefined as Response;
  }

  return (await response.json()) as Response;
}
