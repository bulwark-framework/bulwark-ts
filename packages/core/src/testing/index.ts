import { randomUUID } from "node:crypto";
import type { WorkflowClient, WorkflowHandle } from "@temporalio/client";
import { defaultPayloadConverter } from "@temporalio/common";
import { TestWorkflowEnvironment } from "@temporalio/testing";
import { Worker } from "@temporalio/worker";
import type {
  Activities,
  DecideInput,
  IntakeInput,
  ResolveRubricOutput,
} from "../activities/types.js";
import type { Answers } from "../resolver/answers.js";
import type { Rubric } from "../rubric/schema.js";
import type { RubricRef } from "../store/types.js";
import { BulwarkSearchAttributes } from "../workflows/types.js";
export type History = Awaited<ReturnType<WorkflowHandle["fetchHistory"]>>;
export async function createTestEnvironment({
  activities,
  workflowsPath,
  taskQueue = `bulwark-${randomUUID()}`,
}: {
  activities: Activities;
  workflowsPath: string;
  taskQueue?: string;
}): Promise<{
  env: TestWorkflowEnvironment;
  worker: Worker;
  client: WorkflowClient;
  taskQueue: string;
  teardown(): Promise<void>;
}> {
  const env = await TestWorkflowEnvironment.createTimeSkipping();
  try {
    // The time-skipping server starts with no custom search attributes. Register
    // the Bulwark keyword attributes so a workflow that upserts them does not
    // fail every workflow task with "search attribute ... is not defined".
    // 2 is INDEXED_VALUE_TYPE_KEYWORD.
    await env.connection.operatorService.addSearchAttributes({
      namespace: "default",
      searchAttributes: Object.fromEntries(
        Object.values(BulwarkSearchAttributes).map((name) => [name, 2]),
      ),
    });
    const worker = await Worker.create({
      connection: env.nativeConnection,
      taskQueue,
      workflowsPath,
      activities: {
        resolveRubric: (input) => activities.resolveRubric(input),
        intake: (input) => activities.intake(input),
        decide: (input) => activities.decide(input),
      } satisfies Activities,
    });
    return { env, worker, client: env.client.workflow, taskQueue, teardown: () => env.teardown() };
  } catch (error) {
    await env.teardown();
    throw error;
  }
}
export function mockActivities({
  rubric,
  answers,
  intakeDelay,
}: {
  rubric: Rubric;
  answers: Answers;
  intakeDelay?: (input: IntakeInput) => Promise<void>;
}): Activities & {
  calls: { resolveRubric: RubricRef[]; intake: IntakeInput[]; decide: DecideInput[] };
} {
  const calls = {
    resolveRubric: [] as RubricRef[],
    intake: [] as IntakeInput[],
    decide: [] as DecideInput[],
  };
  return {
    calls,
    async resolveRubric(ref) {
      calls.resolveRubric.push(ref);
      return { rubric, resolvedVersion: rubric.version, contentHash: rubric.content_hash };
    },
    async intake(input) {
      calls.intake.push(input);
      await intakeDelay?.(input);
      return { facet: input.facet, fragment: input.artefacts.json };
    },
    async decide(input) {
      calls.decide.push(input);
      return { answers, responseModel: "mock", usage: { input_tokens: 0, output_tokens: 0 } };
    },
  };
}
/**
 * Fails when a completed run scheduled `resolveRubric` more than once, or
 * scheduled `decide` with a rubric hash other than the pin returned by
 * `resolveRubric` (or, when no resolution is in the history, other than the
 * first decide's hash). Uses the default payload converter.
 */
export function assertAssessmentInvariants(history: History): void {
  const scheduled = new Map<string, string>();
  let resolves = 0;
  let pinnedHash: string | undefined;
  let pinnedFrom = "the resolved pin";
  const decideHashes: unknown[] = [];
  const violations: string[] = [];
  for (const event of history.events ?? []) {
    const schedule = event.activityTaskScheduledEventAttributes;
    const completed = event.activityTaskCompletedEventAttributes;
    if (schedule) {
      const name = schedule.activityType?.name ?? "";
      if (event.eventId != null) scheduled.set(String(event.eventId), name);
      if (name === "resolveRubric") resolves++;
      if (name === "decide") {
        const payload = schedule.input?.payloads?.[0];
        if (!payload) {
          violations.push("decide input is missing");
          continue;
        }
        const input = defaultPayloadConverter.fromPayload<DecideInput>(payload);
        const hash = input?.rubric?.content_hash;
        if (typeof hash !== "string") violations.push("decide rubric.content_hash is missing");
        decideHashes.push(hash);
      }
    } else if (completed && completed.scheduledEventId != null) {
      if (scheduled.get(String(completed.scheduledEventId)) !== "resolveRubric") continue;
      const payload = completed.result?.payloads?.[0];
      const output = payload
        ? defaultPayloadConverter.fromPayload<ResolveRubricOutput>(payload)
        : undefined;
      if (typeof output?.contentHash !== "string") {
        violations.push("resolveRubric result has no contentHash");
      } else if (pinnedHash === undefined) {
        pinnedHash = output.contentHash;
      }
    }
  }
  if (pinnedHash === undefined && decideHashes.length) {
    pinnedFrom = "the first decide";
    pinnedHash = decideHashes[0] as string | undefined;
  }
  for (const hash of decideHashes) {
    if (hash !== pinnedHash) {
      violations.push(`decide rubric.content_hash differs from ${pinnedFrom}`);
      break;
    }
  }
  if (resolves > 1) violations.push(`resolveRubric scheduled ${resolves} times`);
  if (violations.length) throw new Error(violations.join("; "));
}
