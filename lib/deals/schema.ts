import { z } from "zod";
import {
  MAX_DEAL_AMOUNT,
  MAX_DELIVERY_ESTIMATE_DAYS,
  MIN_DEAL_AMOUNT,
} from "@/lib/config";
import { usdToCents } from "./money";

// Boundary schemas for deal input. Amounts arrive as decimal USD strings and
// are converted to integer cents with money.usdToCents().

const USD_AMOUNT_PATTERN = /^\d{1,6}(\.\d{1,2})?$/;
const MIN_CENTS = MIN_DEAL_AMOUNT * 100;
const MAX_CENTS = MAX_DEAL_AMOUNT * 100;

export const usdPriceSchema = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    if (!USD_AMOUNT_PATTERN.test(value)) {
      ctx.addIssue({
        code: "custom",
        message: "Enter a price in USD, like 37.50",
      });
      return;
    }

    const cents = usdToCents(value);
    if (cents < MIN_CENTS) {
      ctx.addIssue({
        code: "custom",
        message: `Enter a price of at least ${MIN_DEAL_AMOUNT.toFixed(2)} USD`,
      });
    } else if (cents > MAX_CENTS) {
      ctx.addIssue({
        code: "custom",
        message: "That price looks like a typo. Check the number of digits",
      });
    }
  });

export const deliveryEstimateDaysSchema = z.coerce
  .number()
  .int("Use a whole number of days")
  .min(1, "The estimate must be at least 1 day")
  .max(
    MAX_DELIVERY_ESTIMATE_DAYS,
    `The estimate cannot exceed ${MAX_DELIVERY_ESTIMATE_DAYS} days`,
  );

export const dealIdSchema = z.uuid("That deal id is not valid");

export const createDealSchema = z
  .object({
    sellerId: z.uuid("Pick a seller"),
    buyerId: z.uuid("Pick a buyer"),
    title: z
      .string()
      .trim()
      .min(1, "Give the deal a title")
      .max(140, "Keep the title under 140 characters"),
    description: z
      .string()
      .trim()
      .max(2000, "Keep the description under 2000 characters")
      .default(""),
    priceUsd: usdPriceSchema,
    deliveryEstimateDays: deliveryEstimateDaysSchema,
  })
  .refine((deal) => deal.sellerId !== deal.buyerId, {
    message: "The seller and the buyer must be different people",
    path: ["buyerId"],
  });

export type CreateDealInput = z.input<typeof createDealSchema>;
export type CreateDealData = z.output<typeof createDealSchema>;
