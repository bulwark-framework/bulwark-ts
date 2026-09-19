import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Answers } from "../../resolver/answers.js";
import { uncertainQuestions } from "../../resolver/bands.js";
import { resolve } from "../../resolver/resolve.js";
import { loadFixture } from "../../store/test-helpers.js";
import { mapAnswers } from "./map-answers.js";

const rubric = loadFixture();
const autoApprove = JSON.parse(
  readFileSync(
    new URL("../../../fixtures/disaster-grant/answers/auto-approve.json", import.meta.url),
    "utf8",
  ),
) as Answers;

const score = (probabilities: Record<string, unknown>, confidence: unknown = 0.9) => ({
  type: "score",
  score: 1.8,
  confidence,
  legend: {},
  probabilities,
});
const choice = (
  probabilities: unknown,
  label: unknown = "not_insured",
  confidence: unknown = 0.8,
) => ({ type: "choice", choice: label, confidence, probabilities });
const fullChoice = {
  not_insured: 0.9,
  insured_no_claim: 0.02,
  claim_pending: 0.02,
  partially_settled: 0.02,
  fully_settled: 0.02,
  none_of_the_above: 0.02,
};

describe("mapAnswers", () => {
  it("maps Noul probability", () => {
    expect(
      mapAnswers(rubric.questions, { business_in_declared_area: { type: "noul", noul: 0.9 } }),
    ).toEqual({ business_in_declared_area: { type: "noul", p: 0.9 } });
  });

  it("maps Choice and copies its distribution", () => {
    const mapped = mapAnswers(rubric.questions, { insurance_overlap: choice(fullChoice) });
    expect(mapped.insurance_overlap).toEqual({
      type: "choice",
      label: "not_insured",
      confidence: 0.8,
      distribution: fullChoice,
    });
    if (mapped.insurance_overlap?.type === "choice")
      expect(mapped.insurance_overlap.distribution).not.toBe(fullChoice);
  });

  it("maps Score to the argmax, not the rounded expected score", () => {
    expect(
      mapAnswers(rubric.questions, { evidence_quality: score({ 0: 0.4, 1: 0, 2: 0, 3: 0.6 }) })
        .evidence_quality,
    ).toEqual({ type: "score", level: 3, confidence: 0.9, distribution: [0.4, 0, 0, 0.6] });
  });

  it("breaks argmax ties at the lowest index", () => {
    expect(
      mapAnswers(rubric.questions, { evidence_quality: score({ 0: 0, 1: 0.5, 2: 0, 3: 0.5 }) })
        .evidence_quality,
    ).toMatchObject({ level: 1 });
  });

  it("tolerates rounding in the probability mass", () => {
    expect(
      mapAnswers(rubric.questions, {
        evidence_quality: score({ 0: 0.333, 1: 0.333, 2: 0.333, 3: 0 }),
      }).evidence_quality,
    ).toMatchObject({ level: 0 });
  });

  it("ignores response ids outside the rubric and omits missing ids", () => {
    expect(mapAnswers(rubric.questions, { unknown: { type: "noul", noul: 1 } })).toEqual({});
    expect(mapAnswers(rubric.questions, {})).toEqual({});
    expect(mapAnswers(rubric.questions, null)).toEqual({});
  });

  describe("drops every response it cannot trust", () => {
    it.each<[string, string, unknown]>([
      ["null response", "evidence_quality", null],
      ["empty object", "evidence_quality", {}],
      ["unknown type", "evidence_quality", { type: "unknown" }],
      ["wrong primitive", "evidence_quality", { type: "noul", noul: 0.9 }],
      ["Noul NaN", "business_in_declared_area", { type: "noul", noul: Number.NaN }],
      ["Noul string", "business_in_declared_area", { type: "noul", noul: "0.9" }],
      ["Noul above 1", "business_in_declared_area", { type: "noul", noul: 1.1 }],
      ["Score null probability", "evidence_quality", score({ 0: null, 1: 0, 2: 0, 3: 1 })],
      ["Score empty distribution", "evidence_quality", score({})],
      ["Score missing keys", "evidence_quality", score({ 3: 1 })],
      ["Score missing mass", "evidence_quality", score({ 0: 0, 1: 0, 2: 0, 3: 0.01 })],
      ["Score extra level", "evidence_quality", score({ 0: 0, 1: 0, 2: 0, 3: 0, 4: 1 })],
      ["Score NaN", "evidence_quality", score({ 0: Number.NaN, 1: 0, 2: 0, 3: 1 })],
      ["Score no probabilities", "evidence_quality", { type: "score", confidence: 1 }],
      ["Score bad confidence", "evidence_quality", score({ 0: 0, 1: 0, 2: 0, 3: 1 }, 1.5)],
      [
        "Choice NaN probability",
        "insurance_overlap",
        choice({ ...fullChoice, not_insured: Number.NaN }),
      ],
      [
        "Choice no probabilities",
        "insurance_overlap",
        { type: "choice", choice: "not_insured", confidence: 1 },
      ],
      ["Choice partial distribution", "insurance_overlap", choice({ not_insured: 1 })],
      ["Choice extra label", "insurance_overlap", choice({ ...fullChoice, bogus: 0 })],
      ["Choice missing mass", "insurance_overlap", choice({ ...fullChoice, not_insured: 0.1 })],
      ["Choice unknown label", "insurance_overlap", choice(fullChoice, "bogus")],
      ["Choice bad confidence", "insurance_overlap", choice(fullChoice, "not_insured", -0.1)],
    ])("%s", (_, id, response) => {
      const mapped = mapAnswers(rubric.questions, { [id]: response });
      expect(mapped).toEqual({});
      expect(uncertainQuestions(mapped, rubric)).toContain(id);
    });
  });

  it("never lets a malformed response reach an automatic route", () => {
    expect(resolve(autoApprove, rubric).route).toBe("auto_approve");
    const forged = {
      evidence_quality: score({ 0: null, 1: 0, 2: 0, 3: 1 }, 1),
      insurance_overlap: choice({ ...fullChoice, not_insured: Number.NaN }, "not_insured", 1),
    };
    const { evidence_quality: _e, insurance_overlap: _i, ...rest } = autoApprove;
    const answers = { ...rest, ...mapAnswers(rubric.questions, forged) };
    const resolution = resolve(answers, rubric);
    expect(resolution.route).not.toBe("auto_approve");
    expect(resolution.uncertain).toEqual(
      expect.arrayContaining(["evidence_quality", "insurance_overlap"]),
    );
  });
});
