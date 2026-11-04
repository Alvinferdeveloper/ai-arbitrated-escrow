import { BookOpen } from "lucide-react";
import Link from "next/link";

/** Seeded deals are read-only snapshots; this says so and points to the real flow. */
export function ExampleDealNotice({ actions }: { actions: string }) {
  return (
    <section
      aria-label="Example deal"
      className="flex items-start gap-3 rounded-lg border border-rule-line bg-sheet p-4"
    >
      <BookOpen aria-hidden="true" size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-postal-ink" />
      <p className="max-w-[65ch] text-[0.9375rem] leading-[1.55] text-ink">
        <span className="font-medium">Example deal, frozen at this step.</span> It shows what this
        screen looks like; {actions} are switched off and no deadline runs.{" "}
        <Link
          href="/seller"
          className="rounded-sm font-medium text-postal-ink underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-postal-ink"
        >
          Create a deal
        </Link>{" "}
        to run the real flow.
      </p>
    </section>
  );
}
