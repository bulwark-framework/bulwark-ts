import { expect, it } from "vitest";
import type { Condition, Rubric } from "../rubric/schema.js";
import { validate } from "../rubric/validate.js";
import { loadFixture } from "../store/test-helpers.js";
import { validateRouting } from "./validate-routing.js";

it.each([
  [{ question: "missing", band: "yes" }, "unknown question"],
  [{ question: "toString", band: "yes" }, "unknown question"],
  [{ question: "needs_senior", equals: "yes" }, "does not fit"],
  [{ question: "insurance_overlap", equals: "missing" }, "not a criterion"],
  [{ question: "insurance_overlap", equals: "toString" }, "not a criterion"],
  [{ question: "evidence_quality", score_below: -1 }, "outside 0..3"],
  [{ question: "evidence_quality", score_above: 4 }, "outside 0..3"],
  [{ question: "evidence_quality", score_above: Number.NaN }, "malformed"],
  [{ question: "insurance_overlap", confidence_below: -1 }, "malformed"],
  [{ question: "insurance_overlap", confidence_below: 2 }, "malformed"],
] satisfies [Condition, string][])("rejects %j", (when, reason) => {
  const fixture = loadFixture();
  fixture.routing.rules = [{ when, route: "assessor", reason: "test" }];
  expect(validateRouting(fixture)).toEqual([
    { rule_index: 0, reason: expect.stringContaining(reason) },
  ]);
});
it("rejects auto_decline default even for callers bypassing the schema", () => {
  const input = {
    ...loadFixture(),
    routing: { rules: [], default: "auto_decline" },
  } as unknown as Rubric;
  expect(validateRouting(input)).toEqual([
    { rule_index: -1, reason: "routing.default must not be auto_decline" },
  ]);
});
it("validates the parsed fixture through both entry points", () => {
  const fixture = loadFixture();
  expect(validate(fixture)).toEqual(fixture);
  expect(validateRouting(fixture)).toEqual([]);
});
it("collects issues with their original indices", () => {
  const fixture = loadFixture();
  fixture.routing.rules = ["absent", "missing"].map((question) => ({
    when: { question, band: "no" },
    route: "assessor",
    reason: "test",
  }));
  expect(validateRouting(fixture).map((issue) => issue.rule_index)).toEqual([0, 1]);
});
