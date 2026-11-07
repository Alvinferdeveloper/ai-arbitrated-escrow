"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { samplePhotoUrl, type SampleScenario } from "@/demo/sample-evidence";
import { DEMO_MODE } from "@/lib/config";
import type { EvidenceSlot } from "@/lib/deals/types";

async function isInstalled(scenario: SampleScenario, slot: EvidenceSlot): Promise<boolean> {
  try {
    const response = await fetch(samplePhotoUrl(scenario.id, slot), { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
}

async function fetchPhoto(scenarioId: string, slot: EvidenceSlot): Promise<File> {
  const response = await fetch(samplePhotoUrl(scenarioId, slot));
  if (!response.ok) throw new Error(`Sample photo ${slot} is missing`);
  const blob = await response.blob();
  return new File([blob], `${slot}.jpg`, { type: blob.type || "image/jpeg" });
}

/**
 * Demo-only shortcut; a scenario shows up once its photos exist. Only sample deals
 * get it: the photos match the sample listing and carry that deal's code.
 */
export function SampleEvidencePicker<Slot extends EvidenceSlot>({
  isSampleDeal,
  scenarios,
  slots,
  disabled,
  onLoad,
  onSelect,
}: {
  isSampleDeal: boolean;
  scenarios: readonly SampleScenario[];
  slots: readonly Slot[];
  disabled: boolean;
  onLoad: (slot: Slot, file: File) => void;
  onSelect?: (scenario: SampleScenario) => void;
}) {
  const [installed, setInstalled] = useState<SampleScenario[]>([]);
  const [selected, setSelected] = useState<SampleScenario | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!DEMO_MODE || !isSampleDeal) return;
    let cancelled = false;

    Promise.all(
      scenarios.map(async (scenario) => ((await isInstalled(scenario, slots[0])) ? scenario : null)),
    ).then((found) => {
      if (!cancelled) setInstalled(found.filter((item): item is SampleScenario => item !== null));
    });

    return () => {
      cancelled = true;
    };
  }, [isSampleDeal, scenarios, slots]);

  if (installed.length === 0) return null;

  async function load(scenario: SampleScenario) {
    setError(null);
    try {
      const files = await Promise.all(
        slots.map(async (slot) => [slot, await fetchPhoto(scenario.id, slot)] as const),
      );
      files.forEach(([slot, file]) => onLoad(slot, file));
      setSelected(scenario);
      onSelect?.(scenario);
    } catch {
      setError("The sample photos could not be loaded. Use your own photos instead.");
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-rule-line p-4">
      <p className="text-[0.875rem] font-medium text-ink">No photos at hand? Load sample evidence</p>
      <div className="flex flex-wrap gap-2">
        {installed.map((scenario) => (
          <Button
            key={scenario.id}
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            aria-pressed={selected?.id === scenario.id}
            onClick={() => load(scenario)}
          >
            {scenario.label}
          </Button>
        ))}
      </div>
      {selected ? (
        <p className="text-[0.8125rem] leading-[1.5] text-ink-muted">
          Expected: {selected.expected} The AI still checks it for real.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-[0.8125rem] leading-[1.5] text-blocked">
          {error}
        </p>
      ) : null}
    </div>
  );
}
