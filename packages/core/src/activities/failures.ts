import { ApplicationFailure } from "@temporalio/common";
import { BulwarkError } from "../rubric/errors.js";

export function toApplicationFailure(error: unknown): unknown {
  return error instanceof BulwarkError
    ? ApplicationFailure.nonRetryable(error.message, error.name, error.details)
    : error;
}

export async function wrapBulwarkErrors<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw toApplicationFailure(error);
  }
}
