import {
  CircleCheck,
  Clock,
  Gavel,
  LockKeyhole,
  MessageSquareWarning,
  RotateCcw,
  Scale,
  ScanSearch,
  ShieldX,
  Truck,
  type LucideIcon,
} from "lucide-react";
import {
  CONFIRMING_PAYMENT,
  STATE_PRESENTATION,
  type StateIcon,
  type StateTone,
} from "@/lib/state-machine/presentation";
import type { DealState } from "@/lib/state-machine/states";

const ICONS: Record<StateIcon, LucideIcon> = {
  clock: Clock,
  lock: LockKeyhole,
  scan: ScanSearch,
  "shield-x": ShieldX,
  truck: Truck,
  message: MessageSquareWarning,
  scale: Scale,
  gavel: Gavel,
  check: CircleCheck,
  refund: RotateCcw,
};

const TONES: Record<StateTone, string> = {
  neutral: "border-rule-line bg-kraft text-ink-muted",
  "postal-ink": "border-postal-ink bg-postal-ink-wash text-postal-ink",
  flagged: "border-flagged bg-flagged-wash text-flagged",
  cleared: "border-cleared bg-cleared-wash text-cleared",
  blocked: "border-blocked bg-blocked-wash text-blocked",
};

export function StateStamp({
  state,
  confirmingPayment = false,
  className = "",
}: {
  state: DealState;
  confirmingPayment?: boolean;
  className?: string;
}) {
  const presentation = confirmingPayment ? CONFIRMING_PAYMENT : STATE_PRESENTATION[state];
  const Icon = ICONS[presentation.icon];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 text-[0.8125rem] font-medium leading-none ${TONES[presentation.tone]} ${className}`}
    >
      <Icon aria-hidden="true" size={16} strokeWidth={1.75} />
      {presentation.label}
    </span>
  );
}
