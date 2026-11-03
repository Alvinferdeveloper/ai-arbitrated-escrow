import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Browser client with the anon key, used only for Realtime broadcasts. RLS
// keeps it out of every table.

let client: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  client ??= createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
