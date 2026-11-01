import "server-only";
import { generateText, Output, type UserContent } from "ai";
import { z } from "zod";
import type {
  ArbitrationImage,
  ArbitrationInput,
  ArbitrationModel,
  EvidenceAuditInput,
  EvidenceImage,
  VisionModel,
} from "./ports";
import {
  ARBITRATION_SYSTEM,
  EVIDENCE_AUDIT_SYSTEM,
  buildArbitrationPrompt,
  buildEvidenceAuditPrompt,
} from "./prompts";
import { resolveModel, type ResolvedModel } from "./provider";
import { buyerEvidenceSchema, evidenceAuditSchema } from "./schemas";

// The only place that calls the model; everything else depends on the ports.

/** `json_object` mode guarantees JSON, not its shape, so the schema goes in the prompt. */
function systemWithSchema(
  system: string,
  schema: z.ZodType,
  structuredOutputs: boolean,
): string {
  if (structuredOutputs) return system;

  return `${system}

Reply with one JSON object that matches this JSON Schema exactly, with no other text:
${JSON.stringify(z.toJSONSchema(schema))}`;
}

function arbitrationImageLabel(
  image: ArbitrationImage,
  buyerPhotoNumber: number,
): string {
  if (image.role === "SELLER_PRODUCT") return "Seller product photo:";
  if (image.role === "SELLER_PARCEL") return "Seller parcel photo:";
  return `Buyer unboxing photo ${buyerPhotoNumber}:`;
}

export function createVisionModel(
  resolved: ResolvedModel = resolveModel(),
): VisionModel & ArbitrationModel {
  const { model, structuredOutputs } = resolved;

  return {
    async auditEvidence(
      input: EvidenceAuditInput,
      images: readonly EvidenceImage[],
      signal: AbortSignal,
    ) {
      const content: UserContent = [
        { type: "text", text: buildEvidenceAuditPrompt(input) },
        ...images.flatMap((image) => [
          { type: "text" as const, text: `Photo ${image.slot}:` },
          {
            type: "file" as const,
            mediaType: image.mediaType,
            data: image.data,
          },
        ]),
      ];

      const { output } = await generateText({
        model,
        system: systemWithSchema(
          EVIDENCE_AUDIT_SYSTEM,
          evidenceAuditSchema,
          structuredOutputs,
        ),
        messages: [{ role: "user", content }],
        output: Output.object({ schema: evidenceAuditSchema }),
        abortSignal: signal,
      });

      return output;
    },

    async arbitrateDispute(
      input: ArbitrationInput,
      images: readonly ArbitrationImage[],
      signal: AbortSignal,
    ) {
      let buyerPhotoNumber = 0;
      const content: UserContent = [
        { type: "text", text: buildArbitrationPrompt(input) },
        ...images.flatMap((image) => {
          const label = arbitrationImageLabel(image, buyerPhotoNumber + 1);
          if (image.role === "BUYER_UNBOXING") buyerPhotoNumber += 1;

          return [
            { type: "text" as const, text: label },
            {
              type: "file" as const,
              mediaType: image.mediaType,
              data: image.data,
            },
          ];
        }),
      ];

      const { output } = await generateText({
        model,
        system: systemWithSchema(
          ARBITRATION_SYSTEM,
          buyerEvidenceSchema,
          structuredOutputs,
        ),
        messages: [{ role: "user", content }],
        output: Output.object({ schema: buyerEvidenceSchema }),
        abortSignal: signal,
      });

      return output;
    },
  };
}
