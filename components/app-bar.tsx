import Link from "next/link";
import type { ReactNode } from "react";
import { APP_NAME } from "@/lib/config";

export function AppBar({ right }: { right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-20 border-b border-rule-line bg-paper">
      <div className="mx-auto flex h-14 w-full max-w-[640px] items-center justify-between gap-4 px-4 md:px-6">
        <Link
          href="/"
          className="rounded-sm text-[0.9375rem] font-semibold tracking-[-0.01em] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-postal-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
        >
          {APP_NAME}
        </Link>
        {right ? (
          <div className="truncate text-[0.8125rem] font-medium text-ink-muted">{right}</div>
        ) : null}
      </div>
    </header>
  );
}
