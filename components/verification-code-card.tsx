import { KeyRound } from "lucide-react";

/** The handwritten code that proves photos A and C were taken for this deal. */
export function VerificationCodeCard({
  code,
  audience,
  isSample,
}: {
  code: string;
  audience: "seller" | "buyer";
  isSample: boolean;
}) {
  return (
    <section
      aria-labelledby="verification-code-heading"
      className="space-y-3 rounded-lg border border-rule-line bg-sheet p-4"
    >
      <h2
        id="verification-code-heading"
        className="flex items-center gap-2 text-[0.9375rem] font-semibold leading-[1.35] text-ink"
      >
        <KeyRound aria-hidden="true" size={18} strokeWidth={1.75} className="text-postal-ink" />
        Verification code
      </h2>
      <p
        aria-label={`Code ${code.split("").join(" ")}`}
        className="font-mono text-[2rem] font-medium leading-none tracking-[0.2em] text-ink"
      >
        {code}
      </p>
      <p className="max-w-[65ch] text-[0.9375rem] leading-[1.55] text-ink-muted">
        {audience === "seller"
          ? "Write it on a paper and keep it in the frame of photo A (next to the product) and photo C (on the sealed parcel). Photos from the internet or an older sale cannot carry it."
          : "The seller must show this code, handwritten, in the product photo and the parcel photo. It proves the photos were taken for your deal, not copied from elsewhere."}
        {isSample ? " The sample photos already show it." : ""}
      </p>
    </section>
  );
}
