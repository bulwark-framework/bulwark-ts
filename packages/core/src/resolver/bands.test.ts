import { describe, expect, it } from "vitest";
import { loadFixture } from "../store/test-helpers.js";
import type { Answer } from "./answers.js";
import { isUncertain, noulBand, uncertainQuestions } from "./bands.js";

const rubric = loadFixture();
describe("bands", () => {
  it.each([
    [0.3, "uncertain"],
    [0.7, "uncertain"],
    [0.3 - 1e-9, "no"],
    [0.7 + 1e-9, "yes"],
  ] as const)("bands %s as %s", (p, band) => {
    expect(noulBand(p, rubric.thresholds)).toBe(band);
  });
  it.each([
    [{ type: "noul", p: 0.5 }, "needs_senior", true],
    [{ type: "noul", p: 0.9 }, "needs_senior", false],
    [
      { type: "choice", label: "none_of_the_above", confidence: 0.9, distribution: {} },
      "insurance_overlap",
      true,
    ],
    [
      { type: "choice", label: "not_insured", confidence: 0.4, distribution: {} },
      "insurance_overlap",
      true,
    ],
    [
      { type: "choice", label: "not_insured", confidence: 0.6, distribution: {} },
      "insurance_overlap",
      false,
    ],
    [{ type: "score", level: 3, confidence: 0.4, distribution: [] }, "evidence_quality", true],
    [{ type: "score", level: 3, confidence: 0.6, distribution: [] }, "evidence_quality", false],
  ] satisfies [Answer, string, boolean][])("uncertainty for %j", (answer, id, expected) => {
    const question = rubric.questions[id];
    if (!question) throw new Error(id);
    expect(isUncertain(answer, question, rubric.thresholds)).toBe(expected);
  });
  it.each([
    [{ type: "noul", p: -1 }, "needs_senior"],
    [{ type: "noul", p: 2 }, "needs_senior"],
    [{ type: "noul", p: Number.NaN }, "needs_senior"],
    [{ type: "choice", label: "unknown", confidence: 0.99, distribution: {} }, "insurance_overlap"],
    [
      { type: "choice", label: "not_insured", confidence: Number.NaN, distribution: {} },
      "insurance_overlap",
    ],
    [
      { type: "choice", label: "not_insured", confidence: 2, distribution: {} },
      "insurance_overlap",
    ],
    [{ type: "score", level: 2.5, confidence: 0.99, distribution: [] }, "evidence_quality"],
    [{ type: "score", level: 99, confidence: 0.99, distribution: [] }, "evidence_quality"],
    [{ type: "score", level: -1, confidence: 0.99, distribution: [] }, "evidence_quality"],
    [{ type: "score", level: 3, confidence: Number.NaN, distribution: [] }, "evidence_quality"],
  ] satisfies [Answer, string][])("treats malformed answer %j as uncertain", (answer, id) => {
    const question = rubric.questions[id];
    if (!question) throw new Error(id);
    expect(isUncertain(answer, question, rubric.thresholds)).toBe(true);
  });

  it("counts an answer of the wrong primitive as uncertain", () => {
    const answers: Record<string, Answer> = {};
    for (const [id, q] of Object.entries(rubric.questions)) {
      answers[id] =
        q.type === "noul"
          ? { type: "noul", p: 0.95 }
          : q.type === "choice"
            ? { type: "choice", label: "not_insured", confidence: 0.95, distribution: {} }
            : { type: "score", level: 3, confidence: 0.95, distribution: [0, 0, 0, 1] };
    }
    expect(uncertainQuestions(answers, rubric)).toEqual([]);
    answers.needs_senior = { type: "score", level: 0, confidence: 0.99, distribution: [1] };
    expect(uncertainQuestions(answers, rubric)).toEqual(["needs_senior"]);
  });

  it("counts missing answers, ignores extra answers, and sorts ids", () => {
    expect(uncertainQuestions({ extra: { type: "noul", p: 0.5 } }, rubric)).toEqual(
      Object.keys(rubric.questions).sort(),
    );
  });
});
