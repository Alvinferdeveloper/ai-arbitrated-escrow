import { describe, expect, it } from "vitest";
import { extractListing, toListingDraft } from "./listing";
import type { ListingModel } from "./ports";

const image = { mediaType: "image/png" as const, data: new Uint8Array([0x89, 0x50]) };

const listing = {
  isListing: true,
  title: "iPhone 14, 128 GB",
  description: "Unlocked, battery at 89%.",
  price: 420,
  currency: "USD",
};

function modelReturning(...results: unknown[]): ListingModel {
  let call = 0;
  return {
    extractListing: async () => {
      const result = results[Math.min(call, results.length - 1)];
      call += 1;
      if (result instanceof Error) throw result;
      return result;
    },
  };
}

describe("toListingDraft()", () => {
  it("fills a USD price with two decimals", () => {
    expect(toListingDraft(listing)).toEqual({
      title: "iPhone 14, 128 GB",
      description: "Unlocked, battery at 89%.",
      priceUsd: "420.00",
      note: null,
    });
  });

  it("treats a price without a currency as USD", () => {
    expect(toListingDraft({ ...listing, currency: null }).priceUsd).toBe("420.00");
  });

  it("leaves a foreign price for the seller instead of converting it", () => {
    const draft = toListingDraft({ ...listing, price: 15000, currency: "NIO" });
    expect(draft.priceUsd).toBeNull();
    expect(draft.note).toContain("NIO");
  });

  it("asks for the price when it was not legible", () => {
    expect(toListingDraft({ ...listing, price: null }).note).toContain("not legible");
  });
});

describe("extractListing()", () => {
  it("returns a draft for a listing", async () => {
    const result = await extractListing({ model: modelReturning(listing), image });
    expect(result).toEqual({ ok: true, draft: expect.objectContaining({ priceUsd: "420.00" }) });
  });

  it("says when the image is not a listing", async () => {
    const result = await extractListing({
      model: modelReturning({ ...listing, isListing: false }),
      image,
    });
    expect(result).toEqual({ ok: false, reason: "NOT_A_LISTING" });
  });

  it("retries once after an error or invalid output", async () => {
    const result = await extractListing({
      model: modelReturning(new Error("503"), listing),
      image,
    });
    expect(result.ok).toBe(true);
  });

  it("fails after two bad answers", async () => {
    const result = await extractListing({ model: modelReturning({ nope: true }), image });
    expect(result).toEqual({ ok: false, reason: "FAILED" });
  });
});
