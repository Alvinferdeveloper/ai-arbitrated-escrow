import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { arbitrateDispute } from "@/lib/agents/arbitration";
import { auditEvidence } from "@/lib/agents/audit";
import { createVisionModel } from "@/lib/agents/model";
import {
  EVIDENCE_PHOTO_SLOTS,
  type ArbitrationImage,
  type EvidenceImage,
} from "@/lib/agents/ports";
import { resolveModel } from "@/lib/agents/provider";
import type { EvidenceRuleContext } from "@/lib/agents/rules";
import { casePhotos, EVAL_CASES, type AuditCase, type DisputeCase, type EvalCase } from "./cases";
import { scoreCase, summarize, type EvalActual, type EvalResult } from "./score";

// Runs the production audit and arbitration against the real model. It stops
// before the state machine, so no deal, database row or PayPal call is involved.

const MEDIA_TYPE = "image/jpeg";
const REPORT_PATH = join("evals", "results", "latest.json");

const { values: args } = parseArgs({
  options: {
    only: { type: "string" },
    photos: { type: "string", default: join("public", "demo-evidence") },
    repeat: { type: "string", default: "1" },
  },
});

const photosRoot = args.photos;
const repeat = Number(args.repeat);
const model = createLazyModel();

function createLazyModel() {
  let handle: { model: ReturnType<typeof createVisionModel>; modelId: string } | null = null;
  return () => {
    if (!handle) {
      const resolved = resolveModel();
      handle = { model: createVisionModel(resolved), modelId: resolved.modelId };
    }
    return handle;
  };
}

function readPhoto(path: string): Uint8Array {
  return new Uint8Array(readFileSync(join(photosRoot, path)));
}

function sellerImages(evalCase: EvalCase): EvidenceImage[] {
  return EVIDENCE_PHOTO_SLOTS.map((slot) => ({
    slot,
    mediaType: MEDIA_TYPE,
    data: readPhoto(evalCase.photos[slot]),
  }));
}

function ruleContext(evalCase: AuditCase): EvidenceRuleContext {
  return {
    priceCents: evalCase.listing.priceCents,
    verificationCode: evalCase.verificationCode,
    freshness: evalCase.dealCreatedAt
      ? { dealCreatedAt: new Date(evalCase.dealCreatedAt), photos: [] }
      : null,
  };
}

async function runAudit(evalCase: AuditCase): Promise<{ actual: EvalActual; detail?: string }> {
  const decision = await auditEvidence({
    model: model().model,
    input: evalCase.listing,
    images: sellerImages(evalCase),
    context: ruleContext(evalCase),
  });

  return {
    actual: {
      outcome: decision.outcome,
      rules: decision.triggeredRules,
      retakeSlots: decision.retakes.map((retake) => retake.slot),
    },
    detail: decision.technicalError ?? decision.audit?.inconsistencies.join(" | "),
  };
}

async function runDispute(evalCase: DisputeCase): Promise<{ actual: EvalActual; detail?: string }> {
  const images = sellerImages(evalCase);
  const seller = await auditEvidence({
    model: model().model,
    input: evalCase.listing,
    images,
    context: { priceCents: evalCase.listing.priceCents },
  });

  if (!seller.audit) {
    return {
      actual: { outcome: "ESCALATE", rules: ["TECHNICAL_FAILURE"], retakeSlots: [] },
      detail: seller.technicalError,
    };
  }

  const disputeImages: ArbitrationImage[] = [
    { role: "SELLER_PRODUCT", mediaType: MEDIA_TYPE, data: readPhoto(evalCase.photos.A) },
    { role: "SELLER_PARCEL", mediaType: MEDIA_TYPE, data: readPhoto(evalCase.photos.C) },
    { role: "BUYER_UNBOXING", mediaType: MEDIA_TYPE, data: readPhoto(evalCase.unboxing) },
  ];

  const decision = await arbitrateDispute({
    model: model().model,
    input: {
      ...evalCase.listing,
      disputeReason: evalCase.disputeReason,
      sellerAudit: seller.audit,
    },
    images: disputeImages,
  });

  return {
    actual: { outcome: decision.outcome, rules: decision.triggeredRules, retakeSlots: [] },
    detail: decision.reason,
  };
}

async function runCase(evalCase: EvalCase): Promise<EvalResult> {
  const { actual, detail } =
    evalCase.kind === "audit" ? await runAudit(evalCase) : await runDispute(evalCase);

  return {
    caseId: evalCase.id,
    verdict: scoreCase(evalCase.expected, actual),
    expected: evalCase.expected,
    actual,
    detail,
  };
}

function missingPhotos(evalCase: EvalCase): string[] {
  return casePhotos(evalCase).filter((path) => !existsSync(join(photosRoot, path)));
}

async function main() {
  if (!Number.isInteger(repeat) || repeat < 1) throw new Error("--repeat must be a positive integer");

  const selected = EVAL_CASES.filter((evalCase) => !args.only || evalCase.id === args.only);
  if (selected.length === 0) throw new Error(`No case is called "${args.only}"`);

  const runnable = selected.filter((evalCase) => missingPhotos(evalCase).length === 0);
  const skipped = selected.filter((evalCase) => !runnable.includes(evalCase));
  const results: EvalResult[] = [];

  for (const evalCase of runnable) {
    for (let run = 1; run <= repeat; run += 1) {
      const result = await runCase(evalCase);
      results.push(result);
      console.log(
        `${result.verdict.padEnd(14)} ${evalCase.id}: expected ${result.expected.outcome}, got ${result.actual.outcome}` +
          (result.actual.rules.length > 0 ? ` [${result.actual.rules.join(", ")}]` : ""),
      );
      if (result.verdict !== "CORRECT" && result.detail) console.log(`               ${result.detail}`);
    }
  }

  for (const evalCase of skipped) {
    console.log(`SKIPPED        ${evalCase.id}: missing ${missingPhotos(evalCase).join(", ")}`);
  }

  if (results.length === 0) {
    console.log(`\nNothing ran: ${skipped.length} of ${selected.length} cases need photos in ${photosRoot}.`);
    process.exitCode = 1;
    return;
  }

  const summary = summarize(results);
  console.log(`
Model:             ${model().modelId}
Cases:             ${runnable.length} of ${selected.length} (${skipped.length} skipped), ${repeat} run(s) each
Correct:           ${summary.correct} of ${summary.ran}
Fraud let through: ${summary.missedFraud} of ${summary.badDeals}
Honest stopped:    ${summary.honestStopped} of ${summary.honestDeals}
Wrong step:        ${summary.wrongStep}
Technical:         ${summary.technical}
Sent to a person:  ${summary.sentToPerson}`);

  mkdirSync(join("evals", "results"), { recursive: true });
  writeFileSync(
    REPORT_PATH,
    `${JSON.stringify(
      {
        ranAt: new Date().toISOString(),
        modelId: model().modelId,
        repeat,
        skipped: skipped.map((evalCase) => evalCase.id),
        summary,
        results,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`\nReport: ${REPORT_PATH}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
