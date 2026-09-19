import type { TypeSafeClient } from "@typesafe-ai/sdk";
import type { Answers } from "../resolver/answers.js";
import type { JsonSchemaNode, Rubric } from "../rubric/schema.js";
import type { RubricRef, RubricStore } from "../store/types.js";

export type ResolveRubricInput = RubricRef;
export interface ResolveRubricOutput {
  rubric: Rubric;
  resolvedVersion: string;
  contentHash: string;
}
export interface IntakeInput {
  caseId: string;
  facet: string;
  artefacts: { json?: unknown; [k: string]: unknown };
  stateSchema: JsonSchemaNode;
}
export interface IntakeOutput {
  facet: string;
  fragment: unknown;
}
export type IntakeAdapter = (input: IntakeInput) => Promise<unknown>;
export interface DecideInput {
  rubric: Rubric;
  state: Record<string, unknown>;
}
export interface DecideOutput {
  answers: Answers;
  responseModel: string;
  usage: { input_tokens: number; output_tokens: number };
}
export interface Activities {
  resolveRubric(input: ResolveRubricInput): Promise<ResolveRubricOutput>;
  intake(input: IntakeInput): Promise<IntakeOutput>;
  decide(input: DecideInput): Promise<DecideOutput>;
}
export const ActivityNames = ["resolveRubric", "intake", "decide"] as const;
export type SystemOneClient = Pick<TypeSafeClient, "systemOne">;
export interface CreateActivitiesOptions {
  store: RubricStore;
  intake?: IntakeAdapter;
  typesafe?: SystemOneClient;
}
