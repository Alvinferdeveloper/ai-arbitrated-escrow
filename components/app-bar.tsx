import Link from "next/link";
import type { ReactNode } from "react";
import { LogoMark } from "@/components/logo";
import { APP_NAME } from "@/lib/config";

const LINK =
  "rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-postal-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper";

export function AppBar({ right }: { right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-20 border-b border-rule-line bg-paper">
      <div className="mx-auto flex h-14 w-full max-w-[640px] items-center justify-between gap-4 px-4 md:px-6">
        <Link
          href="/"
          className={`${LINK} inline-flex items-center gap-2 text-[0.9375rem] font-semibold tracking-[-0.01em] text-ink`}
        >
          <LogoMark className="size-5 text-postal-ink" />
          {APP_NAME}
        </Link>
        <div className="flex min-w-0 items-center gap-4">
          {right ? (
            <span className="hidden truncate text-[0.8125rem] font-medium text-ink-muted sm:inline">
              {right}
            </span>
          ) : null}
          <Link
            href="/deals"
            className={`${LINK} inline-flex h-11 items-center text-[0.875rem] font-medium text-postal-ink`}
          >
            Deals
          </Link>
        </div>
      </div>
    </header>
  );
}
