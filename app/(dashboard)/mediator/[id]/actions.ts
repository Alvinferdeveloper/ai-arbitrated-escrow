"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/db/server";
import { runPendingSettlement } from "@/lib/paypal/settlement-runner";
import { SupabaseMediatorDecisionStore } from "@/lib/db/mediator-store";
import {
  MediationConflictError,
  submitMediatorDecision,
  type MediatorDecisionResult,
} from "@/lib/state-machine/mediator";
import {
  DealNotFoundError,
  GuardedTransitionError,
  InvalidTransitionError,
  TransitionConflictError,
} from "@/lib/state-machine/transition";

const requestSchema = z.discriminatedUnion("action", [
  z.object({
    caseId: z.string().uuid(),
    action: z.literal("RELEASE"),
    note: z.string().trim().max(2000).optional(),
  }),
  z.object({
    caseId: z.string().uuid(),
    action: z.literal("REFUND"),
    note: z.string().trim().max(2000).optional(),
  }),
  z.object({
    caseId: z.string().uuid(),
    action: z.literal("APPROVE_SHIPPING"),
    note: z.string().trim().max(2000).optional(),
  }),
  z.object({
    caseId: z.string().uuid(),
    action: z.literal("REQUEST_EVIDENCE"),
    target: z.enum(["SELLER", "BUYER"]),
    note: z.string().trim().max(2000).optional(),
  }),
]);

export type MediatorActionResult =
  | {
      ok: true;
      status: MediatorDecisionResult["status"];
    }
  | {
      ok: false;
      code: "INVALID_INPUT" | "NOT_CONFIGURED" | "CONFLICT" | "NOT_FOUND" | "FAILED";
      message: string;
    };

export async function decideMediationCase(
  input: unknown,
): Promise<MediatorActionResult> {
  const parsed = requestSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: parsed.error.issues[0]?.message ?? "The decision is invalid.",
    };
  }

  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      code: "NOT_CONFIGURED",
      message:
        "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, then apply the migrations.",
    };
  }

  const decision = parsed.data;

  try {
    const result = await submitMediatorDecision(
      decision.action === "REQUEST_EVIDENCE"
        ? {
            dealId: decision.caseId,
            action: decision.action,
            target: decision.target,
            note: decision.note || undefined,
          }
        : {
            dealId: decision.caseId,
            action: decision.action,
            note: decision.note || undefined,
          },
      new SupabaseMediatorDecisionStore(),
    );

    if (result.status === "SETTLEMENT_QUEUED") {
      await runPendingSettlement(decision.caseId);
    }

    revalidatePath("/mediator");
    revalidatePath(`/mediator/${decision.caseId}`);

    return { ok: true, status: result.status };
  } catch (error) {
    if (error instanceof DealNotFoundError) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "This deal no longer exists.",
      };
    }

    if (
      error instanceof TransitionConflictError ||
      error instanceof InvalidTransitionError ||
      error instanceof GuardedTransitionError ||
      error instanceof MediationConflictError
    ) {
      return {
        ok: false,
        code: "CONFLICT",
        message:
          "The case changed while you were deciding. Refresh the queue and open it again.",
      };
    }

    console.error("Mediator decision failed", error);

    return {
      ok: false,
      code: "FAILED",
      message: "The decision could not be saved. Nothing moved; try again.",
    };
  }
}
