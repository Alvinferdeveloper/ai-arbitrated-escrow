"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const INTERVAL_MS = 3_000;
const GIVE_UP_AFTER_MS = 5 * 60_000;

// Polls while the audit runs. Realtime would need an anon subscription, and
// RLS only lets signed-in parties read audits.
export function AuditWatcher() {
  const router = useRouter();

  useEffect(() => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - startedAt > GIVE_UP_AFTER_MS) {
        clearInterval(timer);
        return;
      }
      router.refresh();
    }, INTERVAL_MS);

    return () => clearInterval(timer);
  }, [router]);

  return null;
}
