import "server-only";
import { anthropic } from "@ai-sdk/anthropic";
import { generateText, Output, type UserContent } from "ai";
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
import { buyerEvidenceSchema, evidenceAuditSchema } from "./schemas";

// The only place that talks to the model provider. Everything else depends on
// the VisionModel port, so tests never hit the network.

function arbitrationImageLabel(
  image: ArbitrationImage,
  buyerPhotoNumber: number,
): string {
  if (image.role === "SELLER_PRODUCT") return "Seller product photo:";
  if (image.role === "SELLER_PARCEL") return "Seller parcel photo:";
  return `Buyer unboxing photo ${buyerPhotoNumber}:`;
}

export function createAnthropicVisionModel(
  modelId = process.env.AI_MODEL,
): VisionModel & ArbitrationModel {
  if (!modelId) {
    throw new Error("AI_MODEL is not set");
  }

  const model = anthropic(modelId);

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
        system: EVIDENCE_AUDIT_SYSTEM,
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
        system: ARBITRATION_SYSTEM,
        messages: [{ role: "user", content }],
        output: Output.object({ schema: buyerEvidenceSchema }),
        abortSignal: signal,
      });

      return output;
    },
  };
}
