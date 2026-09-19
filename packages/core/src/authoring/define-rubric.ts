import { z } from "zod";
import { InvalidRubricError, type RubricIssue } from "../rubric/errors.js";
import { hash } from "../rubric/hash.js";
import type { Question } from "../rubric/schema.js";
import { validate } from "../rubric/validate.js";
import { routingAccessors } from "./routing-builder.js";
import type { RubricDefinition, RubricDefinitionInput } from "./types.js";

/**
 * JSON Schema keywords that `pathResolves` in the rubric schema does not walk.
 * A state schema that emits them would let a typo in `required_paths` pass, so
 * the builder refuses them up front. Unions, nullable objects, tuples,
 * recursive schemas, and constrained records produce these.
 */
const UNSUPPORTED_KEYWORDS = new Set([
  "anyOf",
  "oneOf",
  "allOf",
  "$ref",
  "prefixItems",
  "propertyNames",
  "not",
]);

function findUnsupported(node: unknown, path: string, out: RubricIssue[]): void {
  if (node === null || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const [i, item] of node.entries()) findUnsupported(item, `${path}[${i}]`, out);
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    if (UNSUPPORTED_KEYWORDS.has(key)) {
      out.push({
        path: path ? `state_schema.${path}` : "state_schema",
        message: `"${key}" is not supported in a state schema: required paths cannot be resolved through it`,
      });
    }
    findUnsupported(value, path ? `${path}.${key}` : key, out);
  }
}

/**
 * Serialises the Zod state schema. Zod throws for shapes JSON Schema cannot
 * express (dates, bigints, transforms); that becomes a typed issue. Refinements
 * (`.refine`, `.check`) are dropped by Zod without error: the state schema is a
 * structural contract only, and that limit is documented in the plan.
 */
function stateSchemaOf(state: z.ZodObject): Record<string, unknown> {
  let schema: Record<string, unknown>;
  try {
    schema = z.toJSONSchema(state) as Record<string, unknown>;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new InvalidRubricError([{ path: "state_schema", message }]);
  }
  const issues: RubricIssue[] = [];
  findUnsupported(schema, "", issues);
  if (issues.length > 0) throw new InvalidRubricError(issues);
  return schema;
}

/**
 * Snapshots a value as plain JSON so getters, Dates, and other live objects
 * cannot make the hashed artifact differ from what a store reads back.
 */
function asJson(value: Record<string, unknown>, path: string): Record<string, unknown> {
  try {
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new InvalidRubricError([{ path, message: `not JSON-serialisable: ${message}` }]);
  }
}

export function defineRubric<Q extends Record<string, Question>, S extends z.ZodObject>(
  input: RubricDefinitionInput<Q, S>,
): RubricDefinition {
  return {
    input,
    toArtifact() {
      // Built from named fields only: nothing else on `input` can reach the artifact.
      const parsed = validate({
        scheme: input.scheme,
        version: input.version,
        status: "draft",
        content_hash: `sha256:${"0".repeat(64)}`,
        ...(input.supersedes === undefined ? {} : { supersedes: input.supersedes }),
        state_schema: stateSchemaOf(input.state),
        static_state: asJson(input.static ?? {}, "static_state"),
        questions: asJson(input.questions, "questions"),
        routing: {
          rules: input.routing(routingAccessors(input.questions)),
          default: input.default,
        },
        thresholds: input.thresholds,
        model_pin: input.model_pin,
        provenance: {},
      });
      parsed.content_hash = hash(parsed);
      return parsed;
    },
  };
}
