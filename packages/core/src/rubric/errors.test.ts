import { describe, expect, it } from "vitest";
import {
  BulwarkError,
  type BulwarkErrorJson,
  HashMismatchError,
  IntakeSchemaViolationError,
  InvalidRubricError,
  type RubricIssue,
  RubricNotFoundError,
} from "./errors.js";

function roundTrip(error: BulwarkError): BulwarkErrorJson {
  return JSON.parse(JSON.stringify(error)) as BulwarkErrorJson;
}

const issues: RubricIssue[] = [
  { path: "thresholds", message: "thresholds.lo must be less than thresholds.hi" },
  { path: "routing.rules.0.when", message: 'rule 0 references unknown question "nope"' },
];

describe("BulwarkError", () => {
  it("keeps details and defaults them to an empty object", () => {
    expect(new BulwarkError("boom").details).toEqual({});
    expect(new BulwarkError("boom", { a: 1 }).details).toEqual({ a: 1 });
  });

  it("is an Error with a stable name", () => {
    const error = new BulwarkError("boom");
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("BulwarkError");
    expect(error.stack).toBeTruthy();
  });
});

describe("error hierarchy", () => {
  const cases: [BulwarkError, string][] = [
    [new InvalidRubricError(issues), "InvalidRubricError"],
    [new RubricNotFoundError("disaster-grant", "latest-published"), "RubricNotFoundError"],
    [
      new HashMismatchError("disaster-grant", "2026.9.1", "sha256:aa", "sha256:bb"),
      "HashMismatchError",
    ],
    [new IntakeSchemaViolationError(issues), "IntakeSchemaViolationError"],
  ];

  for (const [error, name] of cases) {
    it(`${name} is a BulwarkError and an Error`, () => {
      expect(error).toBeInstanceOf(BulwarkError);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe(name);
    });

    it(`${name} keeps name, message, and details through a JSON round trip`, () => {
      const json = roundTrip(error);
      expect(json.name).toBe(name);
      expect(json.message).toBe(error.message);
      expect(json.details).toEqual(error.details);
    });
  }
});

describe("InvalidRubricError", () => {
  it("names the issue count in the message and exposes every issue", () => {
    const error = new InvalidRubricError(issues);
    expect(error.message).toContain("2");
    expect(error.issues).toEqual(issues);
    expect(error.details.issues).toEqual(issues);
  });

  it("accepts an explicit message", () => {
    expect(new InvalidRubricError(issues, "custom").message).toBe("custom");
  });
});

describe("RubricNotFoundError", () => {
  it("records scheme and version in details", () => {
    const error = new RubricNotFoundError("disaster-grant", "2026.9.1");
    expect(error.details).toEqual({ scheme: "disaster-grant", version: "2026.9.1" });
    expect(error.message).toContain("disaster-grant");
  });
});

describe("HashMismatchError", () => {
  it("records scheme, version, expected, and actual", () => {
    const error = new HashMismatchError("disaster-grant", "2026.9.1", "sha256:aa", "sha256:bb");
    expect(error.details).toEqual({
      scheme: "disaster-grant",
      version: "2026.9.1",
      expected: "sha256:aa",
      actual: "sha256:bb",
    });
    expect(error.message).toContain("2026.9.1");
  });
});

describe("IntakeSchemaViolationError", () => {
  it("exposes its issues", () => {
    expect(new IntakeSchemaViolationError(issues).issues).toEqual(issues);
  });
});
