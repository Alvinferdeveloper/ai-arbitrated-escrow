import { describe, expect, it } from "vitest";
import { describeMediationDecision } from "./decision";

const context = {
  amountCents: 8500,
  sellerName: "Marta Reyes",
  buyerName: "Priya Nair",
};

describe("describeMediationDecision()", () => {
  it("names the amount and the seller for a release", () => {
    expect(
      describeMediationDecision({ action: "RELEASE" }, context),
    ).toContain("85.00 USD to Marta Reyes");
  });

  it("names the amount and the buyer for a refund", () => {
    expect(
      describeMediationDecision({ action: "REFUND" }, context),
    ).toContain("85.00 USD to Priya Nair");
  });

  it("sends the case back to the seller for more evidence", () => {
    expect(
      describeMediationDecision(
        { action: "REQUEST_EVIDENCE", target: "SELLER" },
        context,
      ),
    ).toContain("back with the seller");
  });

  it("sends the case back to the buyer for more evidence", () => {
    expect(
      describeMediationDecision(
        { action: "REQUEST_EVIDENCE", target: "BUYER" },
        context,
      ),
    ).toContain("back with the buyer");
  });

  it("never claims that money moved before PayPal confirms it", () => {
    for (const decision of [
      { action: "RELEASE" as const },
      { action: "REFUND" as const },
    ]) {
      expect(describeMediationDecision(decision, context)).toContain(
        "until PayPal confirms",
      );
    }

    expect(
      describeMediationDecision(
        { action: "REQUEST_EVIDENCE", target: "SELLER" },
        context,
      ),
    ).toContain("money stays held");
  });

  it("keeps the money held when shipping is approved", () => {
    const copy = describeMediationDecision({ action: "APPROVE_SHIPPING" }, context);
    expect(copy).toContain("Marta Reyes can send the parcel");
    expect(copy).toContain("85.00 USD stays held");
  });
});
