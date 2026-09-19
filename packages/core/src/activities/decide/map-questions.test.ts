import { describe, expect, it } from "vitest";
import { loadFixture } from "../../store/test-helpers.js";
import { mapQuestions } from "./map-questions.js";

const questions = loadFixture().questions;
describe("mapQuestions", () => {
  it.each([
    "business_in_declared_area",
    "applicant_is_owner",
    "insurance_overlap",
    "evidence_quality",
  ])("maps %s without rubric metadata", (id) => {
    const q = questions[id];
    if (!q) throw new Error("missing fixture question");
    expect(mapQuestions(questions)[id]).toEqual({
      type: q.type,
      instructions: q.instructions,
      ...(q.criteria ? { criteria: q.criteria } : {}),
    });
  });
  it("preserves all question keys and sends no extra fields", () => {
    const mapped = mapQuestions(questions);
    expect(Object.keys(mapped)).toEqual(Object.keys(questions));
    expect(Object.keys(mapped)).toHaveLength(10);
    for (const q of Object.values(mapped)) {
      expect(Object.keys(q).sort()).toEqual(
        (q.criteria ? ["type", "instructions", "criteria"] : ["type", "instructions"]).sort(),
      );
    }
  });
  it("checks score tuple length", () => {
    expect(() =>
      mapQuestions({
        score: {
          type: "score",
          instructions: "score",
          criteria: ["only"],
          cites: [],
          required_paths: [],
        },
      }),
    ).toThrow("rubric is invalid");
  });
});
