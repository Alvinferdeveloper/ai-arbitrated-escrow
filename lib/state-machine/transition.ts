import {
  canTransition,
  type Actor,
  type DealState,
} from "./states";

// The only entry point for a deal state change. Persistence lives behind
// DealTransitionStore so the same rules run against Supabase, tests or a replay.

export type JsonObject = Record<string, unknown>;

export type TransitionInput = {
  dealId: string;
  from: DealState;
  to: DealState;
  actor: Actor;
  payload?: JsonObject;
};

export type TransitionRecord = Omit<TransitionInput, "payload"> & {
  payload: JsonObject;
};

export type TransitionEvent = TransitionRecord & {
  occurredAt: Date;
};

export interface DealTransitionStore {
  /**
   * Atomically moves the deal from `from` to `to` and appends the events row.
   * Must throw TransitionConflictError when the stored state is no longer
   * `from`, so two callers cannot race past each other.
   */
  transition(record: TransitionRecord): Promise<TransitionEvent>;
}

export class InvalidTransitionError extends Error {
  constructor(
    readonly dealId: string,
    readonly from: DealState,
    readonly to: DealState,
  ) {
    super(`Deal ${dealId} cannot move from ${from} to ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export class GuardedTransitionError extends Error {
  constructor(
    readonly dealId: string,
    readonly from: DealState,
    readonly to: DealState,
    readonly actor: Actor,
    reason: string,
  ) {
    super(`Deal ${dealId} cannot move from ${from} to ${to} as ${actor}: ${reason}`);
    this.name = "GuardedTransitionError";
  }
}

export class TransitionConflictError extends Error {
  constructor(
    readonly dealId: string,
    readonly expected: DealState,
    readonly actual: DealState | null,
  ) {
    super(
      `Deal ${dealId} is in ${actual ?? "an unknown state"}, expected ${expected}`,
    );
    this.name = "TransitionConflictError";
  }
}

export class DealNotFoundError extends Error {
  constructor(readonly dealId: string) {
    super(`Deal ${dealId} was not found`);
    this.name = "DealNotFoundError";
  }
}

export function assertTransitionAllowed(input: TransitionInput): void {
  const { dealId, from, to, actor } = input;

  if (!canTransition(from, to)) {
    throw new InvalidTransitionError(dealId, from, to);
  }

  // Only PayPal's confirmed webhook may say the money moved. Requests and the
  // AI only start the payout or refund; they never settle the deal themselves.
  if ((to === "RELEASED" || to === "REFUNDED") && actor !== "paypal") {
    throw new GuardedTransitionError(
      dealId,
      from,
      to,
      actor,
      "only the PayPal webhook may settle a deal",
    );
  }

  // Same rule for the incoming capture: the approval route starts the capture,
  // the PAYMENT.CAPTURE.COMPLETED webhook is what puts the money on hold.
  if (from === "AWAITING_PAYMENT" && to === "FUNDS_HELD" && actor !== "paypal") {
    throw new GuardedTransitionError(
      dealId,
      from,
      to,
      actor,
      "only the PayPal webhook may confirm the capture",
    );
  }
}

export async function transition(
  input: TransitionInput,
  store: DealTransitionStore,
): Promise<TransitionEvent> {
  assertTransitionAllowed(input);

  return store.transition({
    dealId: input.dealId,
    from: input.from,
    to: input.to,
    actor: input.actor,
    payload: input.payload ?? {},
  });
}
