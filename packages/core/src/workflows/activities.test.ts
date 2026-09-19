import { proxyActivities } from "@temporalio/workflow";
import { expect, it, vi } from "vitest";
import { bulwarkActivities } from "./activities.js";

vi.mock("@temporalio/workflow", () => ({ proxyActivities: vi.fn(() => ({})) }));
it("supplies retry and timeout defaults", () => {
  bulwarkActivities();
  expect(proxyActivities).toHaveBeenLastCalledWith({
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
  });
});
it("forwards option overrides including replacement retry policy", () => {
  bulwarkActivities({
    startToCloseTimeout: "5s",
    retry: { maximumAttempts: 1 },
    taskQueue: "other",
  });
  expect(proxyActivities).toHaveBeenLastCalledWith({
    startToCloseTimeout: "5s",
    retry: { maximumAttempts: 1 },
    taskQueue: "other",
  });
});
