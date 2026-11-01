"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  SAMPLE_SCENARIOS,
  samplePhotoUrl,
  type SampleScenario,
} from "@/demo/sample-evidence";
import type { EvidencePhotoSlot } from "@/lib/agents/ports";
import { DEMO_MODE } from "@/lib/config";
import { EVIDENCE_UPLOAD_SLOTS } from "@/lib/deals/evidence-upload";

async function isInstalled(scenario: SampleScenario): Promise<boolean> {
  try {
    const response = await fetch(samplePhotoUrl(scenario.id, "A"), { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
}

async function fetchPhoto(scenarioId: string, slot: EvidencePhotoSlot): Promise<File> {
  const response = await fetch(samplePhotoUrl(scenarioId, slot));
  if (!response.ok) throw new Error(`Sample photo ${slot} is missing`);
  const blob = await response.blob();
  return new File([blob], `${slot}.jpg`, { type: blob.type || "image/jpeg" });
}

export function SampleEvidencePicker({
  disabled,
  onLoad,
}: {
  disabled: boolean;
  onLoad: (slot: EvidencePhotoSlot, file: File) => void;
}) {
  const [scenarios, setScenarios] = useState<SampleScenario[]>([]);
  const [selected, setSelected] = useState<SampleScenario | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!DEMO_MODE) return;
    let cancelled = false;

    Promise.all(SAMPLE_SCENARIOS.map(async (scenario) => ((await isInstalled(scenario)) ? scenario : null)))
      .then((found) => {
        if (!cancelled) setScenarios(found.filter((item): item is SampleScenario => item !== null));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (scenarios.length === 0) return null;

  async function load(scenario: SampleScenario) {
    setError(null);
    try {
      const files = await Promise.all(
        EVIDENCE_UPLOAD_SLOTS.map(async (slot) => [slot, await fetchPhoto(scenario.id, slot)] as const),
      );
      files.forEach(([slot, file]) => onLoad(slot, file));
      setSelected(scenario);
    } catch {
      setError("The sample photos could not be loaded. Use your own photos instead.");
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-rule-line p-4">
      <p className="text-[0.875rem] font-medium text-ink">No parcel at hand? Load sample evidence</p>
      <div className="flex flex-wrap gap-2">
        {scenarios.map((scenario) => (
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
          Expected: {selected.expected} The audit still runs for real.
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
