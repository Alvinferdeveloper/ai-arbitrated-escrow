import {
  transition,
  type JsonObject,
  type TransitionEvent,
  type TransitionRecord,
} from "./transition";

// Moving a deal to SHIPPED also opens the dispute window: the tracking from the
// guide is stored and the auto-release deadline is set in the same database
// transaction as the state change. It still goes through transition(), so the
// guards in assertTransitionAllowed() apply.

export type Shipment = {
  carrier: string | null;
  trackingNumber: string | null;
};

export interface ShippingStore {
  /**
   * Atomically moves the deal to SHIPPED, stores the shipment, sets
   * shipped_at and auto_release_at, and appends the events row. Throws
   * TransitionConflictError when the stored state is no longer `from`.
   */
  ship(record: TransitionRecord, shipment: Shipment): Promise<TransitionEvent>;
}

export type ShipDealInput = {
  dealId: string;
  from: "AUDITING" | "ESCALATED";
  actor: "ai" | "mediator";
  shipment: Shipment;
  payload?: JsonObject;
};

export function shipDeal(
  input: ShipDealInput,
  store: ShippingStore,
): Promise<TransitionEvent> {
  return transition(
    {
      dealId: input.dealId,
      from: input.from,
      to: "SHIPPED",
      actor: input.actor,
      payload: input.payload,
    },
    { transition: (record) => store.ship(record, input.shipment) },
  );
}
