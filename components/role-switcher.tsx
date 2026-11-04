import Link from "next/link";
import type { DealState } from "@/lib/state-machine/states";

export type DealRole = "buyer" | "seller" | "mediator";

const ROLES: { role: DealRole; label: string }[] = [
  { role: "buyer", label: "Buyer" },
  { role: "seller", label: "Seller" },
  { role: "mediator", label: "Mediator" },
];

/** A mediator only ever sees escalated deals, so the role is offered only then. */
export function rolesFor(state: DealState): DealRole[] {
  return state === "ESCALATED" ? ["buyer", "seller", "mediator"] : ["buyer", "seller"];
}

export function dealRoleHref(role: DealRole, dealId: string, state: DealState): string {
  if (role === "buyer") return `/t/${dealId}`;
  if (role === "seller") return `/seller/${dealId}`;
  return state === "ESCALATED" ? `/mediator/${dealId}` : "/mediator";
}

// There is no sign-in: the demo lets one person walk every side of a deal.
export function RoleSwitcher({
  dealId,
  state,
  active,
}: {
  dealId: string;
  state: DealState;
  active: DealRole;
}) {
  return (
    <nav aria-label="View this deal as" className="flex items-center gap-3">
      <span className="text-[0.8125rem] font-medium text-ink-muted">View as</span>
      <div className="inline-flex rounded-md border border-rule-line bg-sheet p-0.5">
        {ROLES.filter(({ role }) => rolesFor(state).includes(role)).map(({ role, label }) => {
          const current = role === active;
          return (
            <Link
              key={role}
              href={dealRoleHref(role, dealId, state)}
              aria-current={current ? "page" : undefined}
              className={`inline-flex h-10 min-w-[5.5rem] items-center justify-center rounded-[6px] px-3 text-[0.875rem] font-medium transition-colors duration-150 ease-out-quart focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-postal-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper ${
                current ? "bg-postal-ink text-on-postal-ink" : "text-ink hover:bg-kraft"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
