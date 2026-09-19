import type { Answers } from "../resolver/answers.js";
import type { Resolution } from "../resolver/resolve.js";
import { BulwarkError } from "../rubric/errors.js";
import type { Rubric } from "../rubric/schema.js";
import type { RubricRef } from "../store/types.js";
export interface AssessmentInput {
  caseId: string;
  rubricRef: RubricRef;
  artefacts: Record<string, unknown>;
}
export interface Pinned {
  rubric: Rubric;
  version: string;
  contentHash: string;
}
export interface AssessmentResult {
  caseId: string;
  pinned: Pinned;
  state: Record<string, unknown>;
  answers: Answers;
  model: string;
  usage: { input_tokens: number; output_tokens: number };
  resolution: Resolution;
}
export interface OutcomeRecord {
  caseId: string;
  scheme: string;
  version: string;
  contentHash: string;
  state: AssessmentResult["state"];
  answers: Answers;
  route: Resolution["route"];
  reasons: Resolution["reasons"];
  uncertain: string[];
  model: string;
  usage: AssessmentResult["usage"];
  decidedBy: string;
  decidedAt: string;
  workflowId: string;
  runId: string;
}
export class InvalidInputError extends BulwarkError {
  constructor(details: { unknownFacets: string[] }) {
    super(
      `artefacts name facets not in state_schema: ${details.unknownFacets.join(", ")}`,
      details,
    );
    this.name = "InvalidInputError";
  }
}
export class EvidenceBudgetExhaustedError extends BulwarkError {
  constructor(details: { max: number }) {
    super(`evidence budget exhausted: ${details.max}`, details);
    this.name = "EvidenceBudgetExhaustedError";
  }
}
export const BulwarkSearchAttributes = {
  scheme: "BulwarkScheme",
  rubricVersion: "BulwarkRubricVersion",
  route: "BulwarkRoute",
} as const;
