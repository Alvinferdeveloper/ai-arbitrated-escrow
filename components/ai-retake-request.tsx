import { Camera } from "lucide-react";
import type { AiDecisionView } from "@/lib/deals/types";

export function AiRetakeRequest({ decision }: { decision: AiDecisionView }) {
  if (decision.retakes.length === 0) return null;

  return (
    <section aria-labelledby="retake-heading" className="space-y-3 rounded-lg border border-blocked bg-blocked-wash p-4">
      <div>
        <h2 id="retake-heading" className="text-[0.9375rem] font-semibold leading-[1.35] text-ink">
          The AI asked for new photos
        </h2>
        {decision.attemptsLeft !== null ? (
          <p className="mt-1 text-[0.875rem] leading-[1.55] text-ink">
            {decision.attemptsLeft === 1
              ? "This is the last attempt. If it does not pass, the buyer is refunded."
              : `${decision.attemptsLeft} attempts left before the buyer is refunded.`}
          </p>
        ) : null}
      </div>
      <ul className="space-y-2">
        {decision.retakes.map((retake) => (
          <li key={retake.slot} className="flex items-start gap-2">
            <Camera aria-hidden="true" size={16} strokeWidth={1.75} className="mt-1 shrink-0 text-blocked" />
            <p className="text-[0.9375rem] leading-[1.55] text-ink">{retake.instruction}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
