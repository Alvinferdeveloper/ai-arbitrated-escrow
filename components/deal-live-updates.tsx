"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getSupabaseBrowser } from "@/lib/db/browser";

const POLL_MS = 4_000;
const POLL_FOR_MS = 5 * 60_000;

/**
 * Re-renders the page when the deal changes state, from a Realtime broadcast.
 * While something is in flight (`waiting`), it also polls in case the
 * broadcast is missed or Realtime is unavailable.
 */
export function DealLiveUpdates({ dealId, waiting }: { dealId: string; waiting: boolean }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    if (!supabase) return;

    const channel = supabase
      .channel(`deal:${dealId}`)
      .on("broadcast", { event: "state" }, () => router.refresh())
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [dealId, router]);

  useEffect(() => {
    if (!waiting) return;

    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - startedAt > POLL_FOR_MS) {
        clearInterval(timer);
        return;
      }
      router.refresh();
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [waiting, router]);

  return null;
}
