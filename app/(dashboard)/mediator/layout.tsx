import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ListChecks } from "lucide-react";
import { AppBar } from "@/components/app-bar";

export default function MediatorLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-paper">
      <AppBar right="Mediator view" />
      <div className="mx-auto grid w-full max-w-[1180px] gap-6 px-4 py-6 md:grid-cols-[220px_minmax(0,1fr)] md:px-6 md:py-8">
        <aside className="hidden md:block">
          <div className="sticky top-20 rounded-lg border border-rule-line bg-kraft p-4">
            <p className="text-[0.8125rem] font-medium text-ink-muted">
              Mediation desk
            </p>
            <p className="mt-1 text-[0.875rem] leading-[1.55] text-ink">
              Only deals where a rule fired appear here. The money stays held.
            </p>
            <nav aria-label="Mediator" className="mt-4">
              <Link
                href="/mediator"
                className="flex h-11 items-center gap-2 rounded-md border border-rule-line bg-sheet px-3 text-[0.875rem] font-medium text-ink transition-colors duration-150 ease-out-quart hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-postal-ink focus-visible:ring-offset-2 focus-visible:ring-offset-kraft"
              >
                <ListChecks aria-hidden="true" size={18} strokeWidth={1.75} />
                Queue
              </Link>
            </nav>
            <Link
              href="/"
              className="mt-4 inline-flex items-center gap-1.5 rounded-sm text-[0.8125rem] font-medium text-postal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-postal-ink focus-visible:ring-offset-2 focus-visible:ring-offset-kraft"
            >
              <ArrowLeft aria-hidden="true" size={16} strokeWidth={1.75} />
              Buyer demo
            </Link>
          </div>
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
