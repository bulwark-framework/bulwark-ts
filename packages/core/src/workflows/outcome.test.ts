import { afterEach, expect, it, vi } from "vitest";
import { loadFixture } from "../store/test-helpers.js";
import { buildOutcomeRecord } from "./outcome.js";
import { bulwarkSearchAttributes } from "./search-attributes.js";
import type { AssessmentResult } from "./types.js";

vi.mock("@temporalio/workflow", () => ({
  workflowInfo: () => ({ workflowId: "workflow", runId: "run", startTime: new Date(0) }),
}));
afterEach(() => vi.useRealTimers());
const rubric = loadFixture();
const result: AssessmentResult = {
  caseId: "case",
  pinned: { rubric, version: rubric.version, contentHash: rubric.content_hash },
  state: { value: 1 },
  answers: {},
  model: "mock",
  usage: { input_tokens: 4, output_tokens: 2 },
  resolution: {
    route: "assessor",
    reasons: [{ rule_index: -1, question: "q", reason: "uncertain:q" }],
    uncertain: ["q"],
  },
};
it("builds every audit field using deterministic current time, not start time", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-19T12:00:00Z"));
  expect(buildOutcomeRecord(result, "person")).toEqual({
    caseId: "case",
    scheme: rubric.scheme,
    version: rubric.version,
    contentHash: rubric.content_hash,
    state: { value: 1 },
    answers: {},
    route: "assessor",
    reasons: [{ rule_index: -1, question: "q", reason: "uncertain:q" }],
    uncertain: ["q"],
    model: "mock",
    usage: { input_tokens: 4, output_tokens: 2 },
    decidedBy: "person",
    decidedAt: "2026-09-19T12:00:00.000Z",
    workflowId: "workflow",
    runId: "run",
  });
});
it("formats three keyword attributes", () =>
  expect(bulwarkSearchAttributes(result.pinned, "assessor")).toEqual({
    BulwarkScheme: [rubric.scheme],
    BulwarkRubricVersion: [rubric.version],
    BulwarkRoute: ["assessor"],
  }));
