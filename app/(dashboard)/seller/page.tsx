import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { AppBar } from "@/components/app-bar";
import { CreateDealForm } from "@/components/seller/create-deal-form";
import { listPartyOptions } from "@/lib/db/deal-store";
import { isSupabaseConfigured } from "@/lib/db/server";

export default function SellerPage() {
  return (
    <div className="min-h-[100dvh] bg-paper">
      <AppBar right="Seller demo" />
      <main className="mx-auto w-full max-w-[640px] px-4 pb-20 pt-6 md:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-sm text-[0.8125rem] font-medium text-postal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-postal-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
        >
          <ArrowLeft aria-hidden="true" size={16} strokeWidth={1.75} />
          Back to the demo
        </Link>

        <header className="mt-4">
          <h1 className="text-[1.5rem] font-semibold leading-[1.2] tracking-[-0.015em] text-ink">
            Create a deal
          </h1>
          <p className="mt-2 max-w-[65ch] text-[1rem] leading-[1.55] text-ink">
            Write down what is being sold and for how much. The Trust Link you get
            next is what the buyer opens to pay.
          </p>
        </header>

        <div className="mt-8">
          <Suspense fallback={<CreateDealSkeleton />}>
            <CreateDealSection />
          </Suspense>
        </div>

        <footer className="mt-14 border-t border-rule-line pt-5 text-[0.8125rem] leading-[1.5] text-ink-muted">
          Sandbox demo. No real money moves.
        </footer>
      </main>
    </div>
  );
}

async function CreateDealSection() {
  if (!isSupabaseConfigured()) {
    return (
      <section
        aria-labelledby="setup-heading"
        className="space-y-2 rounded-lg border border-rule-line bg-kraft p-4"
      >
        <h2
          id="setup-heading"
          className="text-[1.125rem] font-semibold leading-[1.35] text-ink"
        >
          Not connected to the database
        </h2>
        <p className="max-w-[65ch] text-[0.9375rem] leading-[1.55] text-ink">
          Deal creation needs Supabase. Set NEXT_PUBLIC_SUPABASE_URL and
          SUPABASE_SERVICE_ROLE_KEY in .env.local, run the migrations in
          supabase/migrations and reload this page. The seeded demo deals stay
          available meanwhile.
        </p>
      </section>
    );
  }

  let options: Awaited<ReturnType<typeof listPartyOptions>>;

  try {
    options = await listPartyOptions();
  } catch (error) {
    console.error("Could not load the seller options", error);

    return (
      <section
        role="alert"
        className="space-y-2 rounded-lg border border-blocked bg-blocked-wash p-4"
      >
        <div className="flex items-center gap-2 text-blocked">
          <AlertCircle aria-hidden="true" size={16} strokeWidth={1.75} />
          <h2 className="text-[1.125rem] font-semibold leading-[1.35]">
            The seller list could not be loaded
          </h2>
        </div>
        <p className="max-w-[65ch] text-[0.9375rem] leading-[1.55] text-ink">
          The database answered with an error. Reload this page in a moment; the
          seeded demo deals stay available meanwhile.
        </p>
      </section>
    );
  }

  return <CreateDealForm sellers={options.sellers} buyers={options.buyers} />;
}

function CreateDealSkeleton() {
  return (
    <div
      className="space-y-6"
      role="status"
      aria-live="polite"
      aria-label="Loading the deal form"
    >
      <span className="sr-only">Loading the deal form</span>
      <div aria-hidden="true" className="grid gap-6 sm:grid-cols-2">
        <div className="h-20 rounded-md bg-kraft" />
        <div className="h-20 rounded-md bg-kraft" />
      </div>
      <div aria-hidden="true" className="h-20 rounded-md bg-kraft" />
      <div aria-hidden="true" className="h-32 rounded-md bg-kraft" />
      <div aria-hidden="true" className="grid gap-6 sm:grid-cols-2">
        <div className="h-20 rounded-md bg-kraft" />
        <div className="h-20 rounded-md bg-kraft" />
      </div>
      <div aria-hidden="true" className="h-12 w-40 rounded-md bg-kraft" />
    </div>
  );
}
