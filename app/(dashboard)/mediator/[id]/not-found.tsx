import Link from "next/link";
import { SearchX } from "lucide-react";

export default function MediatorCaseNotFound() {
  return (
    <div className="rounded-lg border border-rule-line bg-sheet p-8 text-center">
      <SearchX
        aria-hidden="true"
        size={24}
        strokeWidth={1.75}
        className="mx-auto text-ink-muted"
      />
      <h1 className="mt-3 text-[1.125rem] font-semibold text-ink">
        This case is not in the queue
      </h1>
      <p className="mx-auto mt-1 max-w-[46ch] text-[0.875rem] leading-[1.55] text-ink-muted">
        It may have been settled already, or the link may be wrong. The queue only
        lists deals that are still with a mediator.
      </p>
      <Link
        href="/mediator"
        className="mt-4 inline-flex h-11 items-center justify-center rounded-md bg-postal-ink px-4 text-[0.875rem] font-medium text-on-postal-ink transition-colors duration-150 ease-out-quart hover:bg-postal-ink-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-postal-ink focus-visible:ring-offset-2 focus-visible:ring-offset-sheet"
      >
        Back to queue
      </Link>
    </div>
  );
}
