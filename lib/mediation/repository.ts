import "server-only";
import { getDemoMediationCase, getDemoMediationQueue } from "@/demo/mediation";
import {
  getMediationCase as getMediationCaseFromDb,
  listMediationQueue,
} from "@/lib/db/mediation";
import { isSupabaseConfigured } from "@/lib/db/server";
import type { MediationCase, MediationQueueRow } from "./types";

// The screens use Supabase as soon as it is configured. Until then, the seeded
// demo cases keep the flow usable for design work and local smoke tests.

export async function getMediationQueueRows(
  now: Date = new Date(),
): Promise<MediationQueueRow[]> {
  if (isSupabaseConfigured()) {
    return listMediationQueue(now);
  }

  return getDemoMediationQueue(now);
}

export async function getMediationCaseById(
  id: string,
  now: Date = new Date(),
): Promise<MediationCase | null> {
  if (isSupabaseConfigured()) {
    return getMediationCaseFromDb(id);
  }

  return getDemoMediationCase(id, now);
}
