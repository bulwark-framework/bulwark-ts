import type { ActivityOptions } from "@temporalio/workflow";
import { proxyActivities } from "@temporalio/workflow";
import type { Activities } from "../activities/types.js";
export function bulwarkActivities(options?: Partial<ActivityOptions>): Activities {
  return proxyActivities<Activities>({
    startToCloseTimeout: "2 minutes",
    retry: {
      maximumAttempts: 3,
      nonRetryableErrorTypes: [
        "InvalidRubricError",
        "RubricNotFoundError",
        "HashMismatchError",
        "IntakeSchemaViolationError",
      ],
    },
    ...options,
  });
}
