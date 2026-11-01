import {
  transition,
  type JsonObject,
  type TransitionEvent,
  type TransitionRecord,
} from "./transition";

// SHIPPED stores the tracking and the auto-release deadline atomically with the state change.

export type Shipment = {
  carrier: string | null;
  trackingNumber: string | null;
};

export interface ShippingStore {
  /** Throws TransitionConflictError when the stored state is no longer `from`. */
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
