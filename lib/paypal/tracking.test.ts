import { describe, expect, it, vi } from "vitest";
import { InvalidTrackerError, buildTracker, resolveCarrier, trackerId } from "./tracking";
import {
  registerTracking,
  type TrackingGateway,
  type TrackingStore,
  type TrackingTarget,
} from "./tracking-sync";

const DEAL_ID = "b1111111-1111-4111-8111-111111111111";

describe("resolveCarrier", () => {
  it.each([
    ["UPS", "UPS"],
    ["FedEx", "FEDEX"],
    ["DHL Express", "DHL"],
    ["usps", "USPS"],
    ["Correos de Honduras", "CORREOS_DE_HONDURAS"],
  ])("maps %s to the PayPal enum %s", (name, carrier) => {
    expect(resolveCarrier(name)).toEqual({ carrier });
  });

  it("sends an unlisted carrier as OTHER with its name", () => {
    expect(resolveCarrier("  Cargo Expreso ")).toEqual({
      carrier: "OTHER",
      carrier_name_other: "Cargo Expreso",
    });
  });
});

describe("buildTracker", () => {
  it("builds the Orders v2 track body", () => {
    expect(
      buildTracker({ captureId: "8MC585209K746392H", carrier: "UPS", trackingNumber: " 1Z999 " }),
    ).toEqual({
      capture_id: "8MC585209K746392H",
      tracking_number: "1Z999",
      notify_payer: true,
      carrier: "UPS",
    });
  });

  it.each([
    { captureId: "", carrier: "UPS", trackingNumber: "1Z" },
    { captureId: "CAP", carrier: " ", trackingNumber: "1Z" },
    { captureId: "CAP", carrier: "UPS", trackingNumber: "" },
    { captureId: "CAP", carrier: "UPS", trackingNumber: "9".repeat(65) },
  ])("rejects incomplete input %#", (input) => {
    expect(() => buildTracker(input)).toThrow(InvalidTrackerError);
  });
});

describe("trackerId", () => {
  it("reads the newest tracker from the order", () => {
    const order = {
      purchase_units: [{ shipping: { trackers: [{ id: "OLD" }, { id: "CAP-1Z999" }] } }],
    };
    expect(trackerId(order)).toBe("CAP-1Z999");
    expect(trackerId({})).toBeNull();
    expect(trackerId(null)).toBeNull();
  });
});

function setup(target: TrackingTarget | null, addTracking: TrackingGateway["addTracking"]) {
  const store = {
    load: vi.fn<TrackingStore["load"]>().mockResolvedValue(target),
    markRegistered: vi.fn<TrackingStore["markRegistered"]>().mockResolvedValue(),
    markFailed: vi.fn<TrackingStore["markFailed"]>().mockResolvedValue(),
  };
  const gateway = { addTracking: vi.fn(addTracking) };
  return { store, gateway };
}

const TARGET: TrackingTarget = {
  dealId: DEAL_ID,
  orderId: "5O190127TN364715T",
  captureId: "8MC585209K746392H",
  carrier: "Cargo Expreso",
  trackingNumber: "CE123456",
};

describe("registerTracking", () => {
  it("adds the tracking to the order with a stable request id", async () => {
    const { store, gateway } = setup(TARGET, async () => ({
      purchase_units: [{ shipping: { trackers: [{ id: "8MC585209K746392H-CE123456" }] } }],
    }));

    await expect(registerTracking(DEAL_ID, store, gateway)).resolves.toBe("REGISTERED");
    expect(gateway.addTracking).toHaveBeenCalledWith(
      "5O190127TN364715T",
      {
        capture_id: "8MC585209K746392H",
        tracking_number: "CE123456",
        notify_payer: true,
        carrier: "OTHER",
        carrier_name_other: "Cargo Expreso",
      },
      `tracking-${DEAL_ID}`,
    );
    expect(store.markRegistered).toHaveBeenCalledWith(DEAL_ID, "8MC585209K746392H-CE123456");
    expect(store.markFailed).not.toHaveBeenCalled();
  });

  it("records a PayPal failure instead of throwing", async () => {
    const { store, gateway } = setup(TARGET, async () => {
      throw new Error("PayPal 422: UNPROCESSABLE_ENTITY");
    });

    await expect(registerTracking(DEAL_ID, store, gateway)).resolves.toBe("FAILED");
    expect(store.markFailed).toHaveBeenCalledWith(DEAL_ID, "PayPal 422: UNPROCESSABLE_ENTITY");
    expect(store.markRegistered).not.toHaveBeenCalled();
  });

  it("records a missing order or capture without calling PayPal", async () => {
    const { store, gateway } = setup({ ...TARGET, orderId: null }, async () => ({}));

    await expect(registerTracking(DEAL_ID, store, gateway)).resolves.toBe("FAILED");
    expect(gateway.addTracking).not.toHaveBeenCalled();
    expect(store.markFailed).toHaveBeenCalledOnce();
  });

  it("skips deals that are not shipped or already registered", async () => {
    const { store, gateway } = setup(null, async () => ({}));

    await expect(registerTracking(DEAL_ID, store, gateway)).resolves.toBe("SKIPPED");
    expect(gateway.addTracking).not.toHaveBeenCalled();
    expect(store.markFailed).not.toHaveBeenCalled();
  });
});
