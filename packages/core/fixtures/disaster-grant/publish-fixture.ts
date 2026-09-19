import { hash } from "../../src/rubric/hash.js";
import type { Rubric } from "../../src/rubric/schema.js";
import { validate } from "../../src/rubric/validate.js";
import definition from "./rubric.definition.js";

/** Fixture-only publication overlay; this is not the production approval gate. */
export function publishedFixture(): Rubric {
  const parsed = validate({
    ...definition.toArtifact(),
    status: "published",
    provenance: {
      corpus_hashes: {
        "Disaster Recovery Small Business Grant Guidelines 2026":
          "sha256:3b8f0c1d2e4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c",
      },
      golden_eval_id: "eval-fixture-0001",
      golden_eval_result: "pass",
      approved_by: "fixture-author",
      approved_at: "2026-09-19T00:00:00+00:00",
      origin_of_questions: {
        needs_senior: "authored from the escalation guideline for the plan 0002 fixture",
      },
    },
  });
  parsed.content_hash = hash(parsed);
  return parsed;
}
