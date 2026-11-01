import { describe, expect, it } from "vitest";
import type {
  PendingSettlement,
  PayoutRequest,
  PayoutResult,
  RefundRequest,
  RefundResult,
  SettlementGateway,
  SettlementStore,
  MarkSubmittedInput,
} from "./settlement";
import { executeSettlement } from "./settlement";

type StoreState = {
  settlement: PendingSettlement | null;
};

class InMemoryStore implements SettlementStore {
  submitted: MarkSubmittedInput[] = [];
  failures: { id: string; reason: string }[] = [];

  constructor(private state: StoreState) {}

  async getPendingSettlement(): Promise<PendingSettlement | null> {
    return this.state.settlement;
  }

  async markSubmitted(input: MarkSubmittedInput): Promise<void> {
    this.submitted.push(input);
  }

  async markFailed(paymentId: string, reason: string): Promise<void> {
    this.failures.push({ id: paymentId, reason });
  }
}

type GatewayOptions = {
  payoutResult?: PayoutResult;
  refundResult?: RefundResult;
  payoutError?: Error;
  refundError?: Error;
};

class InMemoryGateway implements SettlementGateway {
  payouts: PayoutRequest[] = [];
  refunds: RefundRequest[] = [];

  constructor(private readonly options: GatewayOptions = {}) {}

  async createPayout(request: PayoutRequest): Promise<PayoutResult> {
    this.payouts.push(request);
    if (this.options.payoutError) throw this.options.payoutError;
    return this.options.payoutResult ?? { payoutBatchId: "batch-1" };
  }

  async createRefund(request: RefundRequest): Promise<RefundResult> {
    this.refunds.push(request);
    if (this.options.refundError) throw this.options.refundError;
    return this.options.refundResult ?? { refundId: "refund-1" };
  }
}

function settlement(overrides: Partial<PendingSettlement> = {}): PendingSettlement {
  return {
    paymentId: "payment-1",
    dealId: "deal-1",
    purpose: "PAYOUT",
    amountCents: 1000,
    currency: "USD",
    idempotencyKey: "mediator-release-key",
    sellerPaypalEmail: "seller@example.com",
    captureId: null,
    providerId: null,
    dealState: "ESCALATED",
    ...overrides,
  };
}

describe("executeSettlement", () => {
  it("skips when there is no pending settlement", async () => {
    const store = new InMemoryStore({ settlement: null });
    const gateway = new InMemoryGateway();

    const result = await executeSettlement("deal-1", store, gateway);

    expect(result.outcome).toBe("SKIPPED");
    expect(result.reason).toBe("NO_PENDING_SETTLEMENT");
    expect(gateway.payouts).toHaveLength(0);
    expect(gateway.refunds).toHaveLength(0);
  });

  it("skips on an already submitted settlement", async () => {
    const settlementRow = settlement({ providerId: "batch-1" });
    const store = new InMemoryStore({ settlement: settlementRow });
    const gateway = new InMemoryGateway();

    const result = await executeSettlement("deal-1", store, gateway);

    expect(result.outcome).toBe("SKIPPED");
    expect(result.reason).toBe("ALREADY_SUBMITTED");
    expect(gateway.payouts).toHaveLength(0);
  });

  it("fails and stores the reason when the seller has no payout email", async () => {
    const settlementRow = settlement({ sellerPaypalEmail: null });
    const store = new InMemoryStore({ settlement: settlementRow });
    const gateway = new InMemoryGateway();

    const result = await executeSettlement("deal-1", store, gateway);

    expect(result.outcome).toBe("FAILED");
    expect(store.failures[0]?.id).toBe("payment-1");
    expect(gateway.payouts).toHaveLength(0);
  });

  it("submits a payout with the deal idempotency key", async () => {
    const settlementRow = settlement();
    const store = new InMemoryStore({ settlement: settlementRow });
    const gateway = new InMemoryGateway();

    const result = await executeSettlement("deal-1", store, gateway);

    expect(result.outcome).toBe("SUBMITTED");
    expect(result.payoutBatchId).toBe("batch-1");
    expect(gateway.payouts[0]).toMatchObject({
      recipientEmail: "seller@example.com",
      amountCents: 1000,
      idempotencyKey: "mediator-release-key",
    });
    expect(store.submitted[0]).toMatchObject({
      purpose: "PAYOUT",
      paymentId: "payment-1",
      payoutBatchId: "batch-1",
    });
  });

  it("submits a payout for a shipped deal after the buyer confirms", async () => {
    const settlementRow = settlement({ dealState: "SHIPPED" });
    const store = new InMemoryStore({ settlement: settlementRow });
    const gateway = new InMemoryGateway();

    const result = await executeSettlement("deal-1", store, gateway);

    expect(result.outcome).toBe("SUBMITTED");
    expect(gateway.payouts).toHaveLength(1);
    expect(store.submitted[0]?.purpose).toBe("PAYOUT");
  });

  it("refuses to settle a deal that has not shipped", async () => {
    const settlementRow = settlement({ dealState: "FUNDS_HELD" });
    const store = new InMemoryStore({ settlement: settlementRow });
    const gateway = new InMemoryGateway();

    const result = await executeSettlement("deal-1", store, gateway);

    expect(result.outcome).toBe("SKIPPED");
    expect(result.reason).toBe("DEAL_NOT_OPEN_TO_SETTLE");
    expect(gateway.payouts).toHaveLength(0);
  });

  it("submits a refund using the stored capture id", async () => {
    const settlementRow = settlement({
      purpose: "REFUND",
      captureId: "capture-9",
    });
    const store = new InMemoryStore({ settlement: settlementRow });
    const gateway = new InMemoryGateway();

    const result = await executeSettlement("deal-1", store, gateway);

    expect(result.outcome).toBe("SUBMITTED");
    expect(result.refundId).toBe("refund-1");
    expect(gateway.refunds[0]).toMatchObject({ captureId: "capture-9" });
    expect(store.submitted[0]).toMatchObject({
      purpose: "REFUND",
      refundId: "refund-1",
    });
  });

  it("marks a refund failed when no capture is available", async () => {
    const settlementRow = settlement({ purpose: "REFUND", captureId: null });
    const store = new InMemoryStore({ settlement: settlementRow });
    const gateway = new InMemoryGateway();

    const result = await executeSettlement("deal-1", store, gateway);

    expect(result.outcome).toBe("FAILED");
    expect(result.reason).toBe("CAPTURE_ID_MISSING");
    expect(store.failures[0]?.id).toBe("payment-1");
    expect(gateway.refunds).toHaveLength(0);
  });

  it("keeps the deal open when the gateway fails before submission", async () => {
    const settlementRow = settlement({ sellerPaypalEmail: "seller@example.com" });
    const store = new InMemoryStore({ settlement: settlementRow });
    const gateway = new InMemoryGateway({ payoutError: new Error("payouts disabled") });

    const result = await executeSettlement("deal-1", store, gateway);

    expect(result.outcome).toBe("FAILED");
    expect(result.reason).toContain("payouts disabled");
    expect(store.failures[0]).toMatchObject({
      id: "payment-1",
      reason: "payouts disabled",
    });
    expect(store.submitted).toHaveLength(0);
  });
});
