import { describe, expect, it } from "vitest";
import { CURRENCY } from "@/lib/config";
import { approvalUrl, buildCaptureOrder, capturedId } from "./orders";

const INPUT = {
  dealId: "b1111111-1111-4111-8111-111111111111",
  title: "Sony WH-1000XM4 headphones",
  amountCents: 3750,
  returnUrl: "http://localhost:3000/api/paypal/capture/b1111111-1111-4111-8111-111111111111",
  cancelUrl: "http://localhost:3000/t/b1111111-1111-4111-8111-111111111111?payment=cancelled",
};

describe("buildCaptureOrder", () => {
  it("captures the deal amount in USD and never trusts another source", () => {
    const body = buildCaptureOrder(INPUT) as {
      intent: string;
      purchase_units: {
        reference_id: string;
        amount: { currency_code: string; value: string };
      }[];
    };

    expect(body.intent).toBe("CAPTURE");
    expect(body.purchase_units[0]?.reference_id).toBe(INPUT.dealId);
    expect(body.purchase_units[0]?.amount).toEqual({
      currency_code: CURRENCY,
      value: "37.50",
    });
  });

  it("uses the deal id for custom_id and a prefixed invoice id", () => {
    const body = buildCaptureOrder(INPUT) as {
      purchase_units: { custom_id: string; invoice_id: string }[];
    };

    expect(body.purchase_units[0]?.custom_id).toBe(INPUT.dealId);
    expect(body.purchase_units[0]?.invoice_id).toBe(`shield-${INPUT.dealId}`);
  });

  it("limits the description to PayPal's 127 characters", () => {
    const body = buildCaptureOrder({ ...INPUT, title: "x".repeat(200) }) as {
      purchase_units: { description: string }[];
    };

    expect(body.purchase_units[0]?.description).toHaveLength(127);
  });

  it("returns the buyer to our capture route and allows a cancel", () => {
    const body = buildCaptureOrder(INPUT) as {
      payment_source: {
        paypal: { experience_context: { return_url: string; cancel_url: string } };
      };
    };

    expect(body.payment_source.paypal.experience_context.return_url).toBe(
      INPUT.returnUrl,
    );
    expect(body.payment_source.paypal.experience_context.cancel_url).toBe(
      INPUT.cancelUrl,
    );
  });
});

describe("approvalUrl", () => {
  it("prefers the approve link", () => {
    expect(
      approvalUrl({
        links: [
          { rel: "self", href: "https://api.paypal.test/order" },
          { rel: "approve", href: "https://www.sandbox.paypal.com/checkoutnow?token=1" },
        ],
      }),
    ).toBe("https://www.sandbox.paypal.com/checkoutnow?token=1");
  });

  it("falls back to payer-action", () => {
    expect(
      approvalUrl({
        links: [{ rel: "payer-action", href: "https://www.sandbox.paypal.com/pay?token=2" }],
      }),
    ).toBe("https://www.sandbox.paypal.com/pay?token=2");
  });

  it("returns null when PayPal sent no approval link", () => {
    expect(approvalUrl({ links: [{ rel: "self", href: "https://api.paypal.test" }] })).toBeNull();
    expect(approvalUrl({})).toBeNull();
  });
});

describe("capturedId", () => {
  it("reads the capture id from a completed capture response", () => {
    expect(
      capturedId({
        purchase_units: [
          { payments: { captures: [{ id: "CAPTURE-1", status: "COMPLETED" }] } },
        ],
      }),
    ).toBe("CAPTURE-1");
  });

  it("returns null when there is no capture yet", () => {
    expect(capturedId({ purchase_units: [{ payments: {} }] })).toBeNull();
    expect(capturedId({})).toBeNull();
  });
});
