/**
 * Rubric artifact schema.
 *
 * Canonical source for the rubric contract described in
 * docs/design-docs/rubric-artifact.md. Question criteria shapes mirror
 * `@typesafe-ai/sdk` v0.6.0: Noul takes optional `{ true, false }`, Choice
 * takes a label-to-description map, Score takes an ordered list of at least
 * two levels.
 *
 * Structural rules enforced here (all issues are reported, not just the first):
 *  - every Choice names a no-match label that exists in its criteria
 *  - every `required_paths` entry resolves in `state_schema` or `static_state`
 *  - `thresholds.lo < thresholds.hi`, all three in [0, 1]
 *  - every routing rule references an existing question and uses a condition
 *    that fits the question's type; `equals` names an existing label
 *  - `routing.default` is never `auto_decline`
 *  - `supersedes` never equals `version`
 */
import { z } from "zod";

/** A JSON-ish value the SDK accepts as instructions, a description, or a level. */
const entry = z.union([
  z.string().min(1),
  z.record(z.string(), z.unknown()),
  z.array(z.unknown()),
  z.null(),
]);

export const DEFAULT_NO_MATCH_LABEL = "none_of_the_above";

const questionBase = {
  instructions: z.string().min(1),
  cites: z.array(z.string().min(1)).default([]),
  required_paths: z.array(z.string().min(1)).default([]),
};

export const noulQuestionSchema = z.object({
  ...questionBase,
  type: z.literal("noul"),
  criteria: z.object({ true: entry.optional(), false: entry.optional() }).strict().optional(),
});

export const choiceQuestionSchema = z.object({
  ...questionBase,
  type: z.literal("choice"),
  criteria: z.record(z.string().min(1), entry),
  /** Label that means "none of the options fit". Defaults to `none_of_the_above`. */
  no_match: z.string().min(1).default(DEFAULT_NO_MATCH_LABEL),
});

export const scoreQuestionSchema = z.object({
  ...questionBase,
  type: z.literal("score"),
  criteria: z.array(entry).min(2),
});

export const questionSchema = z.discriminatedUnion("type", [
  noulQuestionSchema,
  choiceQuestionSchema,
  scoreQuestionSchema,
]);

export const routeSchema = z.enum(["auto_approve", "auto_decline", "assessor", "request_info"]);
export const defaultRouteSchema = z.enum(["auto_approve", "assessor", "request_info"]);
export const bandSchema = z.enum(["no", "uncertain", "yes"]);

const unit = z.number().min(0).max(1);

/**
 * One condition on one question. Exactly one condition key is present.
 * `confidence_below: true` means "below `thresholds.conf_floor`".
 */
export const conditionSchema = z.union([
  z.object({ question: z.string().min(1), band: bandSchema }).strict(),
  z.object({ question: z.string().min(1), equals: z.string().min(1) }).strict(),
  z.object({ question: z.string().min(1), is_no_match: z.literal(true) }).strict(),
  z
    .object({ question: z.string().min(1), confidence_below: z.union([unit, z.literal(true)]) })
    .strict(),
  z.object({ question: z.string().min(1), score_below: z.number() }).strict(),
  z.object({ question: z.string().min(1), score_above: z.number() }).strict(),
]);

export const routingRuleSchema = z.object({
  when: conditionSchema,
  route: routeSchema,
  reason: z.string().min(1),
});

export const routingSchema = z.object({
  rules: z.array(routingRuleSchema),
  default: defaultRouteSchema,
});

export const thresholdsSchema = z.object({ lo: unit, hi: unit, conf_floor: unit });

export const statusSchema = z.enum(["draft", "candidate", "published", "deprecated"]);

/**
 * Minimal JSON Schema shape: enough to resolve `required_paths`. Boolean
 * subschemas and tuple `items` are accepted because they are valid JSON Schema
 * and the intake validator (plan 0004) will accept them. Extra keys pass through.
 */
const jsonSchemaNode: z.ZodType<JsonSchemaNode> = z.lazy(() =>
  z.union([
    z.boolean(),
    z
      .object({
        properties: z.record(z.string(), jsonSchemaNode).optional(),
        items: z.union([jsonSchemaNode, z.array(jsonSchemaNode)]).optional(),
        additionalProperties: jsonSchemaNode.optional(),
      })
      .loose(),
  ]),
);

export interface JsonSchemaObject {
  properties?: Record<string, JsonSchemaNode> | undefined;
  items?: JsonSchemaNode | JsonSchemaNode[] | undefined;
  additionalProperties?: JsonSchemaNode | undefined;
  [key: string]: unknown;
}
export type JsonSchemaNode = boolean | JsonSchemaObject;

export const provenanceSchema = z
  .object({
    corpus_hashes: z.record(z.string(), z.string()).optional(),
    compile_workflow_id: z.string().optional(),
    golden_eval_id: z.string().optional(),
    golden_eval_result: z.enum(["pass", "fail"]).optional(),
    corpus_index_ref: z.string().optional(),
    researcher_model: z.string().optional(),
    contextualiser_model: z.string().optional(),
    approved_by: z.string().optional(),
    approved_at: z.iso.datetime({ offset: true }).optional(),
    origin_of_questions: z.record(z.string(), z.string()).optional(),
  })
  .loose();

const rubricShape = z.object({
  scheme: z.string().min(1),
  version: z.string().min(1),
  status: statusSchema,
  content_hash: z.string().regex(/^sha256:[0-9a-f]{64}$/, "content_hash must be sha256:<64 hex>"),
  supersedes: z.string().min(1).optional(),
  state_schema: jsonSchemaNode,
  static_state: z.record(z.string(), z.unknown()).default({}),
  questions: z.record(z.string().min(1), questionSchema),
  routing: routingSchema,
  thresholds: thresholdsSchema,
  model_pin: z.string().min(1),
  provenance: provenanceSchema.default({}),
});

export const rubricSchema = rubricShape.superRefine((rubric, ctx) => {
  const issue = (path: (string | number)[], message: string) =>
    ctx.addIssue({ code: "custom", path, message });

  if (rubric.supersedes === rubric.version) {
    issue(["supersedes"], "supersedes must not equal version");
  }

  if (rubric.thresholds.lo >= rubric.thresholds.hi) {
    issue(["thresholds"], "thresholds.lo must be less than thresholds.hi");
  }

  // Invariant 4: no version publishes without the eval gate passing and a
  // named human approving, both recorded in provenance.
  if (rubric.status === "published") {
    const p = rubric.provenance;
    if (p.golden_eval_result !== "pass") {
      issue(
        ["provenance", "golden_eval_result"],
        'published rubric requires golden_eval_result "pass"',
      );
    }
    if (!p.approved_by)
      issue(["provenance", "approved_by"], "published rubric requires approved_by");
    if (!p.approved_at)
      issue(["provenance", "approved_at"], "published rubric requires approved_at");
  }

  for (const [id, q] of Object.entries(rubric.questions)) {
    if (q.type === "choice" && !Object.hasOwn(q.criteria, q.no_match)) {
      issue(
        ["questions", id, "criteria"],
        `Choice "${id}" has no no-match label "${q.no_match}" in its criteria`,
      );
    }
    q.required_paths.forEach((path, i) => {
      if (!pathResolves(path, rubric.state_schema, rubric.static_state)) {
        issue(
          ["questions", id, "required_paths", i],
          `required path "${path}" does not resolve in state_schema or static_state`,
        );
      }
    });
  }

  rubric.routing.rules.forEach((rule, i) => {
    const q = Object.hasOwn(rubric.questions, rule.when.question)
      ? rubric.questions[rule.when.question]
      : undefined;
    const at = ["routing", "rules", i, "when"];
    if (!q) {
      issue(at, `rule ${i} references unknown question "${rule.when.question}"`);
      return;
    }
    const kind = conditionKind(rule.when);
    const allowed = CONDITIONS_BY_TYPE[q.type];
    if (!allowed.includes(kind)) {
      issue(at, `rule ${i}: condition "${kind}" does not fit a ${q.type} question`);
      return;
    }
    if (
      "equals" in rule.when &&
      q.type === "choice" &&
      !Object.hasOwn(q.criteria, rule.when.equals)
    ) {
      issue(
        at,
        `rule ${i}: label "${rule.when.equals}" is not a criterion of "${rule.when.question}"`,
      );
    }
    if (q.type === "score" && ("score_below" in rule.when || "score_above" in rule.when)) {
      const level = "score_below" in rule.when ? rule.when.score_below : rule.when.score_above;
      const max = q.criteria.length - 1;
      if (level < 0 || level > max) {
        issue(at, `rule ${i}: level ${level} is outside 0..${max} for "${rule.when.question}"`);
      }
    }
  });
});

export type Rubric = z.infer<typeof rubricSchema>;
export type RubricInput = z.input<typeof rubricSchema>;
export type Question = z.infer<typeof questionSchema>;
export type NoulQuestion = z.infer<typeof noulQuestionSchema>;
export type ChoiceQuestion = z.infer<typeof choiceQuestionSchema>;
export type ScoreQuestion = z.infer<typeof scoreQuestionSchema>;
export type QuestionType = Question["type"];
export type Condition = z.infer<typeof conditionSchema>;
export type ConditionKind =
  | "band"
  | "equals"
  | "is_no_match"
  | "confidence_below"
  | "score_below"
  | "score_above";
export type RoutingRule = z.infer<typeof routingRuleSchema>;
export type Route = z.infer<typeof routeSchema>;
export type Band = z.infer<typeof bandSchema>;
export type Thresholds = z.infer<typeof thresholdsSchema>;
export type RubricStatus = z.infer<typeof statusSchema>;
export type Provenance = z.infer<typeof provenanceSchema>;

export const CONDITIONS_BY_TYPE: Record<QuestionType, readonly ConditionKind[]> = {
  noul: ["band"],
  choice: ["equals", "is_no_match", "confidence_below"],
  score: ["confidence_below", "score_below", "score_above"],
};

export function conditionKind(condition: Condition): ConditionKind {
  if ("band" in condition) return "band";
  if ("equals" in condition) return "equals";
  if ("is_no_match" in condition) return "is_no_match";
  if ("confidence_below" in condition) return "confidence_below";
  if ("score_below" in condition) return "score_below";
  return "score_above";
}

/** Splits `a.b[0].c` into `["a", "b", 0, "c"]`. */
export function parsePath(path: string): (string | number)[] {
  const segments: (string | number)[] = [];
  for (const part of path.split(".")) {
    const m = /^([^[\]]+)((?:\[\d+\])*)$/.exec(part);
    if (!m?.[1]) return [];
    segments.push(m[1]);
    for (const idx of m[2]?.match(/\d+/g) ?? []) segments.push(Number(idx));
  }
  return segments;
}

/**
 * A path resolves when walking it through the JSON Schema succeeds, or when it
 * reaches a node that places no constraint on its children (no `properties`,
 * no `items`, `additionalProperties` not `false`), or when it exists as a value
 * in `static_state`. A key missing from a declared `properties` map does not
 * resolve unless `additionalProperties` is explicitly `true` or a schema, so a
 * typo in a required path fails even when the author omitted
 * `additionalProperties: false`.
 */
export function pathResolves(
  path: string,
  schema: JsonSchemaNode,
  staticState: Record<string, unknown>,
): boolean {
  const segments = parsePath(path);
  if (segments.length === 0) return false;
  return resolveInSchema(segments, schema) || resolveInValue(segments, staticState);
}

function resolveInSchema(segments: (string | number)[], node: JsonSchemaNode): boolean {
  let current: JsonSchemaNode = node;
  for (const seg of segments) {
    if (current === false) return false;
    if (current === true) return true;
    if (typeof seg === "number") {
      if (Array.isArray(current.items)) {
        const item = current.items[seg];
        if (item === undefined) return false;
        current = item;
        continue;
      }
      if (current.items !== undefined) {
        current = current.items;
        continue;
      }
      return isPermissive(current);
    }
    if (current.properties) {
      if (Object.hasOwn(current.properties, seg)) {
        current = current.properties[seg] as JsonSchemaNode;
        continue;
      }
      // A key missing from a declared `properties` map is a typo unless the
      // author explicitly opened the object with `additionalProperties`.
      if (current.additionalProperties === undefined || current.additionalProperties === false) {
        return false;
      }
      current = current.additionalProperties;
      continue;
    }
    if (current.additionalProperties !== undefined) {
      current = current.additionalProperties;
      continue;
    }
    return isPermissive(current);
  }
  return current !== false;
}

const SCALAR_TYPES = new Set(["string", "number", "integer", "boolean", "null"]);

/**
 * A node with no child constraints lets any path through, unless it declares
 * a scalar `type`: a string has no children, so `applicant.role.x` is a typo.
 */
function isPermissive(node: JsonSchemaObject): boolean {
  if (node.properties || node.items !== undefined || node.additionalProperties === false) {
    return false;
  }
  const types = Array.isArray(node.type) ? node.type : [node.type];
  return !types.every((t) => typeof t === "string" && SCALAR_TYPES.has(t));
}

function resolveInValue(segments: (string | number)[], value: unknown): boolean {
  let current: unknown = value;
  for (const seg of segments) {
    if (current === null || typeof current !== "object") return false;
    if (typeof seg === "number") {
      if (!Array.isArray(current) || seg >= current.length) return false;
      current = current[seg];
    } else {
      if (!Object.hasOwn(current, seg)) return false;
      current = (current as Record<string, unknown>)[seg];
    }
  }
  return true;
}
