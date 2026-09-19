import {
  ActivityFailure,
  ApplicationFailure,
  setWorkflowOptions,
  upsertSearchAttributes,
} from "@temporalio/workflow";
import type { AssessmentInput } from "../../src/workflows/index.js";
import {
  buildOutcomeRecord,
  bulwarkActivities,
  bulwarkSearchAttributes,
  InvalidInputError,
  isAutomatic,
  runAssessment,
} from "../../src/workflows/index.js";

export async function assessCase(input: AssessmentInput & { maxEvidenceLoops?: number }) {
  const activities = bulwarkActivities();
  // Observe the pin at resolution without resolving a second time.
  const result = await runAssessment(
    {
      intake: activities.intake,
      decide: activities.decide,
      async resolveRubric(ref) {
        const resolved = await activities.resolveRubric(ref);
        upsertSearchAttributes(
          bulwarkSearchAttributes(
            {
              rubric: resolved.rubric,
              version: resolved.resolvedVersion,
              contentHash: resolved.contentHash,
            },
            "assessing",
          ),
        );
        return resolved;
      },
    },
    input,
  ).catch((error) => {
    // Expose the activity's typed application failure at the workflow boundary.
    if (error instanceof ActivityFailure && error.cause instanceof ApplicationFailure)
      throw error.cause;
    throw error;
  });
  upsertSearchAttributes(bulwarkSearchAttributes(result.pinned, result.resolution.route));
  if (isAutomatic(result.resolution)) return buildOutcomeRecord(result, "system");
  // Plan 0006 replaces this arm with human and evidence blocks.
  return {
    pending: result.resolution.route,
    ...buildOutcomeRecord(result, "pending"),
  };
}
setWorkflowOptions({ failureExceptionTypes: [InvalidInputError] }, assessCase);

/** Negative fixture: decides with a rubric whose hash differs from the pin. */
export async function decidesOffPin(input: AssessmentInput) {
  const activities = bulwarkActivities();
  const resolved = await activities.resolveRubric(input.rubricRef);
  return activities.decide({
    rubric: { ...resolved.rubric, content_hash: "0".repeat(64) },
    state: {},
  });
}
export async function resolvesTwice(input: AssessmentInput) {
  const activities = bulwarkActivities();
  await runAssessment(activities, input);
  return runAssessment(activities, input);
}
