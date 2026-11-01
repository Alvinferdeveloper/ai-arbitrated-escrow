import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Service-role client for server code only. RLS is bypassed on purpose after
// the caller has checked the actor; browser clients never get this key.
// Created lazily so builds and demo mode work without Supabase credentials.

let client: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

/**
 * The screens read and write with the service-role key, which bypasses RLS.
 * A publishable/anon key looks valid but is rejected by the table grants, so
 * catch it here where the message can say what is actually wrong.
 */
function assertServiceRoleKey(key: string): void {
  if (key.startsWith("sb_publishable_")) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY contains a publishable key. Use the secret (service_role) key from Supabase Settings → API keys.",
    );
  }

  if (key.startsWith("sb_secret_")) return;

  const parts = key.split(".");
  if (parts.length !== 3) return;

  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    ) as { role?: unknown };

    if (typeof payload.role === "string" && payload.role !== "service_role") {
      throw new Error(
        `SUPABASE_SERVICE_ROLE_KEY belongs to the "${payload.role}" role. Use the service_role key from Supabase Settings → API keys.`,
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      throw error;
    }
  }
}

export function getSupabaseAdmin(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  assertServiceRoleKey(serviceRoleKey);

  client = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return client;
}
