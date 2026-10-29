import { describe, expect, it } from "vitest";
import {
  createDealSchema,
  dealIdSchema,
  deliveryEstimateDaysSchema,
  usdPriceSchema,
} from "./schema";

const sellerId = "11111111-1111-4111-8111-111111111111";
const buyerId = "22222222-2222-4222-8222-222222222222";

const validDeal = {
  sellerId,
  buyerId,
  title: "  Sony WH-1000XM4 headphones  ",
  priceUsd: "37.50",
};

describe("deal schema", () => {
  it("accepts a valid deal and trims the title", () => {
    const result = createDealSchema.parse(validDeal);
    expect(result.title).toBe("Sony WH-1000XM4 headphones");
    expect(result.description).toBe("");
    expect(result.priceUsd).toBe("37.50");
  });

  it("accepts the exact USD range and rejects anything outside it", () => {
    for (const price of ["10", "10.00", "37.50", "100", "100.00"]) {
      expect(usdPriceSchema.safeParse(price).success).toBe(true);
    }
    for (const price of ["9.99", "100.01", "0", "1000", "-10"]) {
      expect(usdPriceSchema.safeParse(price).success).toBe(false);
    }
  });

  it("rejects malformed prices instead of silently rounding", () => {
    for (const price of ["", "abc", "10.999", "1,000", "10.", ".50"]) {
      expect(usdPriceSchema.safeParse(price).success).toBe(false);
    }
  });

  it("rejects the same person as seller and buyer", () => {
    const result = createDealSchema.safeParse({ ...validDeal, buyerId: sellerId });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["buyerId"]);
    }
  });

  it("rejects an empty or oversized title", () => {
    expect(createDealSchema.safeParse({ ...validDeal, title: "   " }).success).toBe(false);
    expect(
      createDealSchema.safeParse({ ...validDeal, title: "a".repeat(141) }).success,
    ).toBe(false);
  });

  it("rejects a description over 2000 characters", () => {
    expect(
      createDealSchema.safeParse({
        ...validDeal,
        description: "a".repeat(2001),
      }).success,
    ).toBe(false);
  });

  it("validates UUIDs at the boundary", () => {
    expect(dealIdSchema.safeParse(sellerId).success).toBe(true);
    expect(dealIdSchema.safeParse("not-a-uuid").success).toBe(false);
    expect(
      createDealSchema.safeParse({ ...validDeal, sellerId: "not-a-uuid" }).success,
    ).toBe(false);
  });

  it("accepts 1 to 14 delivery days and nothing else", () => {
    for (const days of ["1", "7", "14", 14]) {
      expect(deliveryEstimateDaysSchema.safeParse(days).success).toBe(true);
    }
    for (const days of ["0", "15", "1.5", "-1", "abc"]) {
      expect(deliveryEstimateDaysSchema.safeParse(days).success).toBe(false);
    }
  });
});
