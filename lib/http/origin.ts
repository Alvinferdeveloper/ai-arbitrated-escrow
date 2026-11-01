import "server-only";
import { headers } from "next/headers";

// Absolute origin for PayPal return URLs. APP_URL wins when set (Vercel), and
// localhost falls back to http because the sandbox accepts a local return URL.

export async function requestOrigin(): Promise<string> {
  const configured = process.env.APP_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;

  const incoming = await headers();
  const host =
    incoming.get("x-forwarded-host")?.trim() ||
    incoming.get("host")?.trim();

  if (!host) {
    throw new Error("Could not build the app URL: set APP_URL.");
  }

  const forwardedProto = incoming.get("x-forwarded-proto")?.trim();
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host);
  const proto = forwardedProto === "https" || forwardedProto === "http"
    ? forwardedProto
    : isLocal
      ? "http"
      : "https";

  return `${proto}://${host}`;
}
