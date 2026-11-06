import { ArrowRight } from "lucide-react";
import { formatMoney } from "@/lib/deals/money";

function Party({ name, role }: { name: string; role: string }) {
  return (
    <div>
      <p className="text-[0.9375rem] font-medium text-ink">{name}</p>
      <p className="mt-0.5 text-[0.8125rem] leading-[1.3] text-ink-muted">{role}</p>
    </div>
  );
}

function Arrow() {
  return <ArrowRight aria-hidden="true" size={16} strokeWidth={1.75} className="text-ink-muted" />;
}

/** The whole product in one line: the money waits between the two strangers. */
export function HeldBetween({ amountCents }: { amountCents: number }) {
  return (
    <figure className="rounded-lg border border-rule-line bg-sheet p-4">
      <div className="grid grid-cols-[1fr_auto_1.4fr_auto_1fr] items-center gap-2 text-center">
        <Party name="Buyer" role="pays first" />
        <Arrow />
        <div className="rounded-md bg-kraft px-2 py-2">
          <p className="font-mono text-[0.875rem] font-medium tabular-nums text-ink">
            {formatMoney(amountCents)}
          </p>
          <p className="mt-0.5 text-[0.8125rem] leading-[1.3] text-ink-muted">held by us</p>
        </div>
        <Arrow />
        <Party name="Seller" role="paid last" />
      </div>
      <figcaption className="mt-4 border-t border-dashed border-rule-line pt-3 text-center text-[0.875rem] leading-[1.55] text-ink">
        While we hold it, an AI checks the seller&apos;s parcel photos.
      </figcaption>
    </figure>
  );
}
