"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/db/server";
import {
  DealPartyNotFoundError,
  InvalidDealError,
  createDeal,
} from "@/lib/db/deal-store";
import { createDealSchema } from "@/lib/deals/schema";

// Manual deal creation (FR1). The form posts here; the schema at the boundary
// decides what a valid deal is. On success the seller lands on the deal page,
// which links the Trust Link to share.

export type CreateDealField =
  | "sellerId"
  | "buyerId"
  | "title"
  | "description"
  | "priceUsd"
  | "deliveryEstimateDays";

export type CreateDealFormState = {
  status:
    | "IDLE"
    | "INVALID_INPUT"
    | "NOT_CONFIGURED"
    | "PARTY_NOT_FOUND"
    | "FAILED";
  message: string | null;
  fieldErrors: Partial<Record<CreateDealField, string>>;
};

export const initialCreateDealState: CreateDealFormState = {
  status: "IDLE",
  message: null,
  fieldErrors: {},
};

const formFieldSchema = z.object({
  sellerId: z.string(),
  buyerId: z.string(),
  title: z.string(),
  description: z.string(),
  priceUsd: z.string(),
  deliveryEstimateDays: z.string(),
});

function fieldFromIssuePath(path: (string | number | symbol)[]):
  | CreateDealField
  | undefined {
  const first = path[0];
  if (typeof first !== "string") return undefined;
  if (first === "sellerId" || first === "buyerId" || first === "title") return first;
  if (first === "description" || first === "priceUsd") return first;
  if (first === "deliveryEstimateDays") return first;
  return undefined;
}

export async function createDealAction(
  _previous: CreateDealFormState,
  formData: FormData,
): Promise<CreateDealFormState> {
  const raw = formFieldSchema.safeParse({
    sellerId: formData.get("sellerId") ?? "",
    buyerId: formData.get("buyerId") ?? "",
    title: formData.get("title") ?? "",
    description: formData.get("description") ?? "",
    priceUsd: formData.get("priceUsd") ?? "",
    deliveryEstimateDays: formData.get("deliveryEstimateDays") ?? "",
  });

  const parsed = raw.success ? createDealSchema.safeParse(raw.data) : null;

  if (!parsed || !parsed.success) {
    const issues =
      !parsed && !raw.success
        ? raw.error.issues
        : parsed?.success === false
          ? parsed.error.issues
          : [];

    const fieldErrors: CreateDealFormState["fieldErrors"] = {};

    for (const issue of issues) {
      const field = fieldFromIssuePath(issue.path);
      if (field && !fieldErrors[field]) {
        fieldErrors[field] = issue.message;
      }
    }

    return {
      status: "INVALID_INPUT",
      message: "The deal could not be saved. Check the fields marked below.",
      fieldErrors,
    };
  }

  if (!isSupabaseConfigured()) {
    return {
      status: "NOT_CONFIGURED",
      message:
        "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, then apply the migrations.",
      fieldErrors: {},
    };
  }

  let dealId: string;

  try {
    dealId = await createDeal(parsed.data);
  } catch (error) {
    if (error instanceof DealPartyNotFoundError) {
      return {
        status: "PARTY_NOT_FOUND",
        message:
          "The selected seller or buyer is no longer available. Pick them again and resend.",
        fieldErrors: { [error.party]: "Pick this person again." },
      };
    }

    if (error instanceof InvalidDealError) {
      return {
        status: "INVALID_INPUT",
        message: error.message,
        fieldErrors: {},
      };
    }

    console.error("Deal creation failed", error);

    return {
      status: "FAILED",
      message:
        "The deal could not be created. Nothing was charged; try again.",
      fieldErrors: {},
    };
  }

  redirect(`/seller/${dealId}`);
}
