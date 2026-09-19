import { expect, it } from "vitest";
import { intake } from "../activities/intake.js";
import type { Activities, DecideInput } from "../activities/types.js";
import { loadFixture } from "../store/test-helpers.js";
import { mockActivities } from "../testing/index.js";
import { reassess, runAssessment } from "./run-assessment.js";
import { InvalidInputError } from "./types.js";

it.each([true, false])("boolean schema %s rejects every facet", async (state_schema) => {
  const activities = mockActivities({ rubric: { ...loadFixture(), state_schema }, answers: {} });
  await expect(
    runAssessment(activities, {
      caseId: "c",
      rubricRef: { scheme: "s", version: "v" },
      artefacts: { a: 1 },
    }),
  ).rejects.toBeInstanceOf(InvalidInputError);
  expect(activities.calls.intake).toHaveLength(0);
});
it("nests each fragment under its facet, passes envelopes, wraps raw values, and keeps static state last", async () => {
  const rubric = { ...loadFixture(), static_state: { applicant: { policy: "trusted" } } };
  const activities = mockActivities({ rubric, answers: {} });
  const result = await runAssessment(activities, {
    caseId: "c",
    rubricRef: { scheme: "s", version: "v" },
    artefacts: {
      applicant: { role: "owner", policy: "bad" },
      business: { json: { abn: "1" }, source: "form" },
    },
  });
  expect(result.state).toEqual({
    applicant: { role: "owner", policy: "trusted" },
    business: { abn: "1" },
  });
  expect(activities.calls.intake[1]?.artefacts).toEqual({ json: { abn: "1" }, source: "form" });
  const updated = await reassess(activities, result, { applicant: { role: "director" } });
  expect(updated.state).toEqual({
    applicant: { role: "director", policy: "trusted" },
    business: { abn: "1" },
  });
  expect(updated.pinned).toBe(result.pinned);
  expect(updated.caseId).toBe("c");
  await expect(reassess(activities, result, { unknown: {} })).rejects.toBeInstanceOf(
    InvalidInputError,
  );
  expect(activities.calls.intake).toHaveLength(3);
});
it("keeps scalar and array fragments that a root merge would drop", async () => {
  const rubric = {
    ...loadFixture(),
    state_schema: {
      type: "object",
      properties: { count: { type: "number" }, tags: { type: "array" } },
    },
  };
  const activities = mockActivities({ rubric, answers: {} });
  const result = await runAssessment(activities, {
    caseId: "c",
    rubricRef: { scheme: "s", version: "v" },
    artefacts: { count: 3, tags: ["a", "b"] },
  });
  expect(result.state).toMatchObject({ count: 3, tags: ["a", "b"] });
});
it("produces the state the rubric's questions address when the real intake validates fragments", async () => {
  const rubric = loadFixture();
  const decided: DecideInput[] = [];
  const activities: Activities = {
    resolveRubric: async () => ({
      rubric,
      resolvedVersion: rubric.version,
      contentHash: rubric.content_hash,
    }),
    intake: intake(async (input) => input.artefacts.json),
    decide: async (input) => {
      decided.push(input);
      return { answers: {}, responseModel: "mock", usage: { input_tokens: 0, output_tokens: 0 } };
    },
  };
  const applicant = { role: "owner", identity_verified: true };
  const result = await runAssessment(activities, {
    caseId: "c",
    rubricRef: { scheme: rubric.scheme, version: rubric.version },
    artefacts: { applicant },
  });
  expect(result.state.applicant).toEqual(applicant);
  expect(decided[0]?.state).toMatchObject({ applicant, policy: rubric.static_state.policy });
  expect(Object.keys(result.state)).toEqual(["applicant", "policy"]);
  // The wrong shape (a partial root instead of the facet value) is rejected by intake itself.
  await expect(
    runAssessment(activities, {
      caseId: "c",
      rubricRef: { scheme: rubric.scheme, version: rubric.version },
      artefacts: { applicant: { applicant } },
    }),
  ).rejects.toMatchObject({ type: "IntakeSchemaViolationError" });
});
