/**
 * Validation entry points for rubric documents.
 *
 * `validate` reports every schema violation at once, never just the first.
 * `validateWithHash` adds the content-hash check a store performs on read.
 */
import { validateRouting } from "../resolver/validate-routing.js";
import { HashMismatchError, InvalidRubricError, type RubricIssue } from "./errors.js";
import { hash } from "./hash.js";
import { type Rubric, rubricSchema } from "./schema.js";

/** Joins Zod path segments into a dotted path such as `routing.rules.0.when`. */
function toPath(segments: readonly PropertyKey[]): string {
  return segments.map((segment) => String(segment)).join(".");
}

/**
 * Parses `input` against the rubric schema.
 *
 * @throws InvalidRubricError carrying every issue found, each with a dotted
 * path and the schema's message.
 */
export function validate(input: unknown): Rubric {
  const result = rubricSchema.safeParse(input);
  if (result.success) {
    const issues = validateRouting(result.data).map(({ rule_index, reason }) => ({
      path: rule_index === -1 ? "routing.default" : `routing.rules.${rule_index}`,
      message: reason,
    }));
    if (issues.length > 0) throw new InvalidRubricError(issues);
    return result.data;
  }
  const issues: RubricIssue[] = result.error.issues.map((issue) => ({
    path: toPath(issue.path),
    message: issue.message,
  }));
  throw new InvalidRubricError(issues);
}

/**
 * Validates `input` and checks its declared `content_hash`.
 *
 * The hash is computed over the *parsed* rubric, so a document that omits the
 * schema defaults hashes the same as one that writes them out.
 *
 * @throws InvalidRubricError when the document does not validate.
 * @throws HashMismatchError when `content_hash` does not match the content.
 */
export function validateWithHash(input: unknown): Rubric {
  const rubric = validate(input);
  const actual = hash(rubric);
  if (actual !== rubric.content_hash) {
    throw new HashMismatchError(rubric.scheme, rubric.version, rubric.content_hash, actual);
  }
  return rubric;
}
