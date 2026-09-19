import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { WorkflowFailedError } from "@temporalio/client";
import { ApplicationFailure } from "@temporalio/common";
import { expect, it } from "vitest";
import type { Answers } from "../../src/resolver/answers.js";
import { merge } from "../../src/resolver/merge.js";
import { loadFixture } from "../../src/store/test-helpers.js";
import {
  assertAssessmentInvariants,
  createTestEnvironment,
  mockActivities,
} from "../../src/testing/index.js";
import type { OutcomeRecord } from "../../src/workflows/index.js";

const rubric = loadFixture();
const input = {
  caseId: "case-1",
  rubricRef: { scheme: rubric.scheme, version: "latest-published" },
  artefacts: {
    applicant: { role: "owner", identity_verified: true },
    business: { json: { abn: "123" } },
  },
};
function answers(name = "auto-approve"): Answers {
  return JSON.parse(
    readFileSync(
      new URL(`../../fixtures/disaster-grant/answers/${name}.json`, import.meta.url),
      "utf8",
    ),
  );
}
async function run(
  name: string,
  mocks: ReturnType<typeof mockActivities>,
  args: unknown[] = [input],
  check?: (
    value: unknown,
    history: Awaited<ReturnType<import("@temporalio/client").WorkflowHandle["fetchHistory"]>>,
  ) => void,
) {
  const test = await createTestEnvironment({
    activities: mocks,
    workflowsPath: createRequire(import.meta.url).resolve("./index.ts"),
  });
  try {
    await test.worker.runUntil(async () => {
      const handle = await test.client.start(name, {
        taskQueue: test.taskQueue,
        workflowId: randomUUID(),
        args,
      });
      const value = await handle.result();
      check?.(value, await handle.fetchHistory());
    });
  } finally {
    await test.teardown();
  }
}
it("pins once, starts every facet before any completes, merges static state, and records search attributes", async () => {
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started = 0;
  let completed = 0;
  const mocks = mockActivities({
    rubric,
    answers: answers(),
    intakeDelay: async () => {
      started++;
      expect(completed).toBe(0);
      if (started === 2) release();
      await barrier;
      completed++;
    },
  });
  await run("assessCase", mocks, [input], (value, history) => {
    assertAssessmentInvariants(history);
    const upserts = history.events?.filter(
      (event) => event.upsertWorkflowSearchAttributesEventAttributes,
    );
    expect(upserts).toHaveLength(2);
    expect(value).toMatchObject({ route: "auto_approve" });
  });
  expect(mocks.calls.resolveRubric).toEqual([input.rubricRef]);
  expect(mocks.calls.intake.map((call) => call.facet)).toEqual(
    expect.arrayContaining(["applicant", "business"]),
  );
  expect(mocks.calls.decide[0]?.state).toEqual(
    merge(
      {
        applicant: { applicant: input.artefacts.applicant },
        business: { business: input.artefacts.business.json },
      },
      rubric.static_state,
    ),
  );
  expect(mocks.calls.decide[0]?.state).toMatchObject({
    applicant: { role: "owner" },
    business: { abn: "123" },
  });
  expect(completed).toBe(2);
}, 60000);
it.each(["auto-approve", "auto-decline"])(
  "builds the complete %s system outcome",
  async (name) => {
    const mocks = mockActivities({ rubric, answers: answers(name) });
    await run("assessCase", mocks, [input], (value) => {
      const record = value as OutcomeRecord;
      expect(record).toEqual({
        caseId: input.caseId,
        scheme: rubric.scheme,
        version: rubric.version,
        contentHash: rubric.content_hash,
        state: mocks.calls.decide[0]?.state,
        answers: answers(name),
        route: name.replaceAll("-", "_"),
        reasons: expect.any(Array),
        uncertain: [],
        model: "mock",
        usage: { input_tokens: 0, output_tokens: 0 },
        decidedBy: "system",
        decidedAt: expect.any(String),
        workflowId: expect.any(String),
        runId: expect.any(String),
      });
      expect(Number.isFinite(Date.parse(record.decidedAt))).toBe(true);
    });
  },
  60000,
);
it("returns pending assessor for senior-required", async () => {
  await run(
    "assessCase",
    mockActivities({ rubric, answers: answers("senior-required") }),
    [input],
    (value) =>
      expect(value).toMatchObject({ pending: "assessor", route: "assessor", decidedBy: "pending" }),
  );
}, 60000);
it("rejects unknown facets after resolve and before intake", async () => {
  const mocks = mockActivities({ rubric, answers: answers() });
  await expect(
    run("assessCase", mocks, [{ ...input, artefacts: { z: {}, a: {} } }]),
  ).rejects.toMatchObject({
    cause: {
      type: "InvalidInputError",
      message: "artefacts name facets not in state_schema: z, a",
    },
  });
  expect(mocks.calls.intake).toHaveLength(0);
  expect(mocks.calls.resolveRubric).toHaveLength(1);
}, 60000);
it("reassesses only supplied facets with no second resolution", async () => {
  const mocks = mockActivities({ rubric, answers: answers() });
  const facets = { applicant: { role: "updated", identity_verified: false } };
  await run("reassessment", mocks, [input, facets], (_, history) =>
    assertAssessmentInvariants(history),
  );
  expect(mocks.calls.resolveRubric).toHaveLength(1);
  expect(mocks.calls.intake).toHaveLength(3);
  expect(mocks.calls.intake[2]?.facet).toBe("applicant");
  expect(mocks.calls.decide[1]?.state).toEqual(
    merge(
      { previous: mocks.calls.decide[0]?.state, applicant: { applicant: facets.applicant } },
      rubric.static_state,
    ),
  );
  expect(mocks.calls.decide[1]?.state).toMatchObject({
    applicant: facets.applicant,
    business: { abn: "123" },
  });
  expect(mocks.calls.decide[1]?.rubric.content_hash).toBe(rubric.content_hash);
}, 60000);
it.each(["HashMismatchError", "IntakeSchemaViolationError"])(
  "surfaces %s as a typed workflow failure",
  async (type) => {
    const mocks = mockActivities({ rubric, answers: answers() });
    if (type === "HashMismatchError")
      mocks.decide = async () => {
        throw ApplicationFailure.nonRetryable("bad hash", type);
      };
    else
      mocks.intake = async () => {
        throw ApplicationFailure.nonRetryable("bad intake", type);
      };
    const failure = await run("assessCase", mocks).catch((error) => error);
    expect(failure).toBeInstanceOf(WorkflowFailedError);
    expect(failure).toMatchObject({ cause: { type } });
  },
  60000,
);
it("detects a workflow that resolves twice", async () => {
  await run(
    "resolvesTwice",
    mockActivities({ rubric, answers: answers() }),
    [input],
    (_, history) =>
      expect(() => assertAssessmentInvariants(history)).toThrow("resolveRubric scheduled 2 times"),
  );
}, 60000);
it("detects a decide scheduled with a rubric hash other than the resolved pin", async () => {
  await run(
    "decidesOffPin",
    mockActivities({ rubric, answers: answers() }),
    [input],
    (_, history) =>
      expect(() => assertAssessmentInvariants(history)).toThrow(
        "decide rubric.content_hash differs from the resolved pin",
      ),
  );
}, 60000);
