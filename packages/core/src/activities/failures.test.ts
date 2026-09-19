import { ApplicationFailure } from "@temporalio/common";
import { APIConnectionError } from "@typesafe-ai/sdk";
import { describe, expect, it } from "vitest";
import {
  BulwarkError,
  HashMismatchError,
  IntakeSchemaViolationError,
  InvalidRubricError,
  RubricNotFoundError,
} from "../rubric/errors.js";
import { toApplicationFailure, wrapBulwarkErrors } from "./failures.js";

describe("activity failures", () => {
  it.each([
    new BulwarkError("base", { reason: "test" }),
    new InvalidRubricError([{ path: "questions", message: "invalid" }]),
    new RubricNotFoundError("scheme", "version"),
    new HashMismatchError("scheme", "version", "expected", "actual"),
    new IntakeSchemaViolationError([{ path: "business", message: "invalid" }]),
  ])("wraps $name with its details", async (error) => {
    const failure = toApplicationFailure(error);
    expect(failure).toBeInstanceOf(ApplicationFailure);
    expect(failure).toMatchObject({
      type: error.name,
      nonRetryable: true,
      details: [error.details],
      message: error.message,
    });
    await expect(
      wrapBulwarkErrors(async () => {
        throw error;
      }),
    ).rejects.toMatchObject({ type: error.name, nonRetryable: true, details: [error.details] });
  });
  it.each([new TypeError("bad"), new APIConnectionError("boom")])(
    "preserves $name by identity",
    async (error) => {
      expect(toApplicationFailure(error)).toBe(error);
      await expect(
        wrapBulwarkErrors(async () => {
          throw error;
        }),
      ).rejects.toBe(error);
    },
  );
  it("returns a successful result", async () => {
    const value = {};
    expect(await wrapBulwarkErrors(async () => value)).toBe(value);
  });
});
