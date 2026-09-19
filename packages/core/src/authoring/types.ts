import type { z } from "zod";
import type { Question, Route, RoutingRule, Rubric, Thresholds } from "../rubric/schema.js";
import type { RoutingAccessors } from "./routing-builder.js";

export interface RubricDefinitionInput<Q extends Record<string, Question>, S extends z.ZodObject> {
  scheme: string;
  version: string;
  model_pin: string;
  supersedes?: string;
  state: S;
  static?: Record<string, unknown>;
  questions: Q;
  thresholds: Thresholds;
  routing: (q: RoutingAccessors<Q>) => RoutingRule[];
  default: Exclude<Route, "auto_decline">;
}

export interface RubricDefinition {
  toArtifact(): Rubric;
  readonly input: Readonly<
    Omit<RubricDefinitionInput<Record<string, Question>, z.ZodObject>, "routing"> & {
      routing: unknown;
    }
  >;
}
