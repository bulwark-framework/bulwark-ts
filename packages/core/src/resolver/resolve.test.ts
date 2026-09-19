import { readFileSync } from "node:fs";
import { describe, expect, expectTypeOf, it } from "vitest";
import type { Condition, Question, RoutingRule, Rubric } from "../rubric/schema.js";
import { loadFixture } from "../store/test-helpers.js";
import type { Answer, Answers } from "./answers.js";
import { type Resolution, resolve } from "./resolve.js";

const fixture = loadFixture();
const noul: Question = { type: "noul", instructions: "test", cites: [], required_paths: [] };
const choice: Question = {
  ...noul,
  type: "choice",
  criteria: { step_2: "yes", none_of_the_above: "none" },
  no_match: "none_of_the_above",
};
const score: Question = { ...noul, type: "score", criteria: ["zero", "one", "two", "three"] };
function rubric(
  question: Question,
  rules: RoutingRule[] = [],
  defaultRoute: Rubric["routing"]["default"] = "request_info",
): Rubric {
  return { ...fixture, questions: { q: question }, routing: { rules, default: defaultRoute } };
}
function rule(
  when: Condition,
  route: RoutingRule["route"] = "assessor",
  reason = "matched",
): RoutingRule {
  return { when, route, reason };
}
describe("resolve", () => {
  it.each([
    [noul, { type: "noul", p: 0.1 }, { question: "q", band: "no" }],
    [noul, { type: "noul", p: 0.5 }, { question: "q", band: "uncertain" }],
    [noul, { type: "noul", p: 0.9 }, { question: "q", band: "yes" }],
    [
      choice,
      { type: "choice", label: "step_2", confidence: 0.9, distribution: {} },
      { question: "q", equals: "step_2" },
    ],
    [
      choice,
      { type: "choice", label: "none_of_the_above", confidence: 0.9, distribution: {} },
      { question: "q", is_no_match: true },
    ],
    [
      choice,
      { type: "choice", label: "step_2", confidence: 0.5, distribution: {} },
      { question: "q", confidence_below: true },
    ],
    [
      choice,
      { type: "choice", label: "step_2", confidence: 0.7, distribution: {} },
      { question: "q", confidence_below: 0.8 },
    ],
    [
      score,
      { type: "score", level: 1, confidence: 0.5, distribution: [] },
      { question: "q", confidence_below: true },
    ],
    [
      score,
      { type: "score", level: 1, confidence: 0.7, distribution: [] },
      { question: "q", confidence_below: 0.8 },
    ],
    [
      score,
      { type: "score", level: 1, confidence: 0.9, distribution: [] },
      { question: "q", score_below: 2 },
    ],
    [
      score,
      { type: "score", level: 3, confidence: 0.9, distribution: [] },
      { question: "q", score_above: 2 },
    ],
  ] satisfies [Question, Answer, Condition][])(
    "matches %j with %j against %j",
    (question, answer, condition) => {
      expect(resolve({ q: answer }, rubric(question, [rule(condition)])).reasons).toEqual([
        { rule_index: 0, question: "q", reason: "matched" },
      ]);
    },
  );
  it("first match wins with exactly one reason", () => {
    expect(
      resolve(
        { q: { type: "noul", p: 0.9 } },
        rubric(noul, [
          rule({ question: "q", band: "yes" }, "auto_approve", "first"),
          rule({ question: "q", band: "yes" }, "auto_decline", "second"),
        ]),
      ),
    ).toEqual({
      route: "auto_approve",
      reasons: [{ rule_index: 0, question: "q", reason: "first" }],
      uncertain: [],
    });
  });
  it("returns the default reason when no rule matches", () => {
    expect(
      resolve({ q: { type: "noul", p: 0.9 } }, rubric(noul, [rule({ question: "q", band: "no" })])),
    ).toEqual({
      route: "request_info",
      reasons: [{ rule_index: -1, question: "", reason: "default" }],
      uncertain: [],
    });
  });
  it.each(["auto_approve", "auto_decline"] as const)(
    "skips low-confidence equals on %s and continues to a human rule",
    (route) => {
      const result = resolve(
        { q: { type: "choice", label: "step_2", confidence: 0.4, distribution: {} } },
        rubric(choice, [
          rule({ question: "q", equals: "step_2" }, route),
          rule({ question: "q", confidence_below: true }),
        ]),
      );
      expect(result).toEqual({
        route: "assessor",
        reasons: [{ rule_index: 1, question: "q", reason: "matched" }],
        uncertain: ["q"],
      });
    },
  );
  it("no-match overrides an automatic default", () => {
    expect(
      resolve(
        { q: { type: "choice", label: "none_of_the_above", confidence: 0.8, distribution: {} } },
        rubric(choice, [], "auto_approve"),
      ),
    ).toEqual({
      route: "assessor",
      reasons: [{ rule_index: -1, question: "q", reason: "uncertain:q" }],
      uncertain: ["q"],
    });
  });
  it.each(["auto_approve", "auto_decline"] as const)("uncertainty elsewhere blocks %s", (route) => {
    const input = rubric(noul, [rule({ question: "q", band: "yes" }, route)]);
    input.questions.other = noul;
    expect(
      resolve({ q: { type: "noul", p: 0.9 }, other: { type: "noul", p: 0.5 } }, input),
    ).toEqual({
      route: "assessor",
      reasons: [{ rule_index: -1, question: "other", reason: "uncertain:other" }],
      uncertain: ["other"],
    });
  });
  it("missing answers do not match and block automatic routes", () => {
    expect(
      resolve({}, rubric(noul, [rule({ question: "q", band: "uncertain" })], "auto_approve")),
    ).toEqual({
      route: "assessor",
      reasons: [{ rule_index: -1, question: "q", reason: "uncertain:q" }],
      uncertain: ["q"],
    });
  });
  it("a mismatched answer type never matches and makes the question uncertain", () => {
    const result = resolve(
      { q: { type: "score", level: 3, confidence: 0.9, distribution: [] } },
      rubric(noul, [rule({ question: "q", band: "yes" })]),
    );
    expect(result.route).toBe("assessor");
    expect(result.uncertain).toEqual(["q"]);
    expect(result.reasons).toEqual([{ rule_index: -1, question: "q", reason: "uncertain:q" }]);
  });
  it.each([
    { question: "q", score_below: 2 },
    { question: "q", score_above: 2 },
    { question: "q", confidence_below: 0.6 },
    { question: "q", confidence_below: true },
  ] satisfies Condition[])("comparison is strict for %j", (when) => {
    expect(
      resolve(
        { q: { type: "score", level: 2, confidence: 0.6, distribution: [] } },
        rubric(score, [rule(when)]),
      ).reasons[0]?.reason,
    ).toBe("default");
  });
  it("is deterministic, preserves inputs, and returns the public shape", () => {
    const answers: Answers = { q: { type: "noul", p: 0.5 } };
    const input = rubric(noul);
    const before = structuredClone({ answers, input });
    const first = resolve(answers, input);
    expectTypeOf(first).toEqualTypeOf<Resolution>();
    expect(resolve(answers, input)).toEqual(first);
    expect({ answers, input }).toEqual(before);
  });
  it("fixture: auto-approve", () => {
    const answers: Answers = JSON.parse(
      readFileSync(
        new URL("../../fixtures/disaster-grant/answers/auto-approve.json", import.meta.url),
        "utf8",
      ),
    );
    expect(Object.keys(answers).sort()).toEqual(Object.keys(fixture.questions).sort());
    expect(resolve(answers, fixture)).toMatchInlineSnapshot(`
      {
        "reasons": [
          {
            "question": "evidence_quality",
            "reason": "itemised invoices cover the claimed costs (Guideline 4.2)",
            "rule_index": 8,
          },
        ],
        "route": "auto_approve",
        "uncertain": [],
      }
    `);
  });
  it("fixture: auto-decline", () => {
    const answers: Answers = JSON.parse(
      readFileSync(
        new URL("../../fixtures/disaster-grant/answers/auto-decline.json", import.meta.url),
        "utf8",
      ),
    );
    expect(Object.keys(answers).sort()).toEqual(Object.keys(fixture.questions).sort());
    expect(resolve(answers, fixture)).toMatchInlineSnapshot(`
{
  "reasons": [
    {
      "question": "business_in_declared_area",
      "reason": "the business is outside every declared area (s11)",
      "rule_index": 0,
    },
  ],
  "route": "auto_decline",
  "uncertain": [],
}
`);
  });
  it("fixture: uncertain-needs-senior", () => {
    const answers: Answers = JSON.parse(
      readFileSync(
        new URL(
          "../../fixtures/disaster-grant/answers/uncertain-needs-senior.json",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    expect(Object.keys(answers).sort()).toEqual(Object.keys(fixture.questions).sort());
    expect(resolve(answers, fixture)).toMatchInlineSnapshot(`
{
  "reasons": [
    {
      "question": "needs_senior",
      "reason": "escalation indicators are unclear (Guideline 6.1)",
      "rule_index": 2,
    },
  ],
  "route": "assessor",
  "uncertain": [
    "needs_senior",
  ],
}
`);
  });
  it("fixture: no-match-insurance", () => {
    const answers: Answers = JSON.parse(
      readFileSync(
        new URL("../../fixtures/disaster-grant/answers/no-match-insurance.json", import.meta.url),
        "utf8",
      ),
    );
    expect(Object.keys(answers).sort()).toEqual(Object.keys(fixture.questions).sort());
    expect(resolve(answers, fixture)).toMatchInlineSnapshot(`
      {
        "reasons": [
          {
            "question": "insurance_overlap",
            "reason": "the insurance position does not fit any option",
            "rule_index": 5,
          },
        ],
        "route": "assessor",
        "uncertain": [
          "insurance_overlap",
        ],
      }
    `);
  });
  it("fixture: low-evidence", () => {
    const answers: Answers = JSON.parse(
      readFileSync(
        new URL("../../fixtures/disaster-grant/answers/low-evidence.json", import.meta.url),
        "utf8",
      ),
    );
    expect(Object.keys(answers).sort()).toEqual(Object.keys(fixture.questions).sort());
    expect(resolve(answers, fixture)).toMatchInlineSnapshot(`
      {
        "reasons": [
          {
            "question": "evidence_quality",
            "reason": "evidence does not substantiate the claimed costs (Guideline 4.2)",
            "rule_index": 7,
          },
        ],
        "route": "request_info",
        "uncertain": [],
      }
    `);
  });
  it("fixture: senior-required", () => {
    const answers: Answers = JSON.parse(
      readFileSync(
        new URL("../../fixtures/disaster-grant/answers/senior-required.json", import.meta.url),
        "utf8",
      ),
    );
    expect(resolve(answers, fixture)).toMatchInlineSnapshot(`
      {
        "reasons": [
          {
            "question": "needs_senior",
            "reason": "a senior assessor must see this case (Guideline 6.1)",
            "rule_index": 3,
          },
        ],
        "route": "assessor",
        "uncertain": [],
      }
    `);
  });
});
