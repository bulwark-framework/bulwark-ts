import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { type ConditionKind, conditionKind } from "./schema.js";
import { validateWithHash } from "./validate.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(here, "../../fixtures/disaster-grant/rubric.json");
const rubric = validateWithHash(JSON.parse(readFileSync(fixturePath, "utf8")));

const ALL_KINDS: ConditionKind[] = [
  "band",
  "equals",
  "is_no_match",
  "confidence_below",
  "score_below",
  "score_above",
];

describe("disaster-grant fixture", () => {
  it("validates and its content_hash matches its content", () => {
    expect(rubric.scheme).toBe("disaster-grant");
    expect(rubric.version).toBe("2026.9.1");
    expect(rubric.status).toBe("published");
    expect(rubric.content_hash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("has exactly ten questions", () => {
    expect(Object.keys(rubric.questions)).toHaveLength(10);
  });

  it("covers all three primitives, including a needs_senior Noul", () => {
    const types = new Set(Object.values(rubric.questions).map((q) => q.type));
    expect([...types].sort()).toEqual(["choice", "noul", "score"]);
    expect(rubric.questions.needs_senior?.type).toBe("noul");
  });

  it("gives every question at least one citation and one required path", () => {
    for (const [id, question] of Object.entries(rubric.questions)) {
      expect(question.cites.length, `${id} cites`).toBeGreaterThan(0);
      expect(question.required_paths.length, `${id} required_paths`).toBeGreaterThan(0);
    }
  });

  it("uses every routing condition kind at least once", () => {
    const used = new Set(rubric.routing.rules.map((rule) => conditionKind(rule.when)));
    for (const kind of ALL_KINDS) {
      expect([...used], `missing condition kind ${kind}`).toContain(kind);
    }
  });

  it("routes to a person by default and never auto-declines by default", () => {
    expect(rubric.routing.default).toBe("assessor");
    const routes = new Set(rubric.routing.rules.map((rule) => rule.route));
    expect([...routes].sort()).toEqual([
      "assessor",
      "auto_approve",
      "auto_decline",
      "request_info",
    ]);
  });
});
