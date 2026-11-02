import {
  EVIDENCE_PHOTO_SLOTS,
  type EvidenceAuditInput,
  type EvidenceImage,
  type VisionModel,
} from "./ports";
import { evaluateEvidenceRules, type EvidenceOutcome, type RetakeRequest } from "./rules";
import { ESCALATION_RULES, type EscalationRuleId } from "./rules.config";
import { evidenceAuditSchema, type EvidenceAudit } from "./schemas";
import { withTimeout } from "./timeout";

// Orchestrates one audit: call the model, validate its output, then apply the
// explicit rules. An error, timeout or invalid object is retried; if it keeps
// failing it becomes a technical failure, which never moves money.

export type EvidenceAuditDecision = {
  outcome: EvidenceOutcome;
  triggeredRules: EscalationRuleId[];
  retakes: RetakeRequest[];
  audit: EvidenceAudit | null;
  technicalError?: string;
};

export type AuditEvidenceOptions = {
  model: VisionModel;
  input: EvidenceAuditInput;
  images: readonly EvidenceImage[];
  timeoutMs?: number;
};

function technicalFailure(message: string): EvidenceAuditDecision {
  return {
    outcome: "ESCALATE",
    triggeredRules: ["TECHNICAL_FAILURE"],
    retakes: [],
    audit: null,
    technicalError: message,
  };
}

function hasAllPhotos(images: readonly EvidenceImage[]): boolean {
  if (images.length !== EVIDENCE_PHOTO_SLOTS.length) return false;
  const slots = new Set(images.map((image) => image.slot));
  return EVIDENCE_PHOTO_SLOTS.every((slot) => slots.has(slot));
}

export async function auditEvidence({
  model,
  input,
  images,
  timeoutMs = ESCALATION_RULES.auditTimeoutMs,
}: AuditEvidenceOptions): Promise<EvidenceAuditDecision> {
  if (!hasAllPhotos(images)) {
    return technicalFailure("Photos A, B and C are required");
  }

  let lastError = "The evidence audit failed";

  for (let attempt = 0; attempt <= ESCALATION_RULES.technicalRetries; attempt += 1) {
    try {
      const raw = await withTimeout(
        (signal) => model.auditEvidence(input, images, signal),
        timeoutMs,
      );

      const parsed = evidenceAuditSchema.safeParse(raw);
      if (parsed.success) {
        return evaluateEvidenceRules(parsed.data, { priceCents: input.priceCents });
      }
      lastError = "The model returned invalid evidence data";
    } catch (error) {
      lastError = error instanceof Error ? error.message : "The evidence audit failed";
    }
  }

  return technicalFailure(lastError);
}
