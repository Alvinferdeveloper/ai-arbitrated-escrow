import type { SandboxBuyer } from "@/lib/paypal/config";

export function SandboxBuyerNote({ buyer }: { buyer: SandboxBuyer }) {
  return (
    <section
      aria-labelledby="sandbox-buyer-heading"
      className="space-y-2 rounded-lg border border-dashed border-rule-line p-4"
    >
      <h3 id="sandbox-buyer-heading" className="text-[0.875rem] font-medium text-ink">
        Paying in the demo? Log in to PayPal with this sandbox buyer
      </h3>
      <dl className="grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-1 text-[0.875rem]">
        <dt className="text-ink-muted">Email</dt>
        <dd className="select-all break-all font-mono text-ink">{buyer.email}</dd>
        <dt className="text-ink-muted">Password</dt>
        <dd className="select-all break-all font-mono text-ink">{buyer.password}</dd>
      </dl>
      <p className="text-[0.8125rem] leading-[1.5] text-ink-muted">
        Sandbox money only. Nothing real is charged.
      </p>
    </section>
  );
}
