import { describe, expect, it } from "vitest";
import { HashMismatchError, InvalidRubricError } from "./errors.js";
import { hash } from "./hash.js";
import type { RubricInput } from "./schema.js";
import { validate, validateWithHash } from "./validate.js";

const PLACEHOLDER = `sha256:${"0".repeat(64)}`;

function minimal(): RubricInput {
  return {
    scheme: "demo",
    version: "2026.9.1",
    status: "draft",
    content_hash: PLACEHOLDER,
    state_schema: { properties: { applicant: { properties: { role: {} } } } },
    questions: {
      residency_met: {
        type: "noul",
        instructions: "Is the applicant a resident?",
        required_paths: ["applicant.role"],
      },
    },
    routing: {
      rules: [
        {
          when: { question: "residency_met", band: "no" },
          route: "auto_decline",
          reason: "not a resident",
        },
      ],
      default: "assessor",
    },
    thresholds: { lo: 0.3, hi: 0.7, conf_floor: 0.6 },
    model_pin: "jev-1.13.0",
  };
}

/** Same document with a `content_hash` that matches its parsed content. */
function sealed(): RubricInput {
  const input = minimal();
  input.content_hash = hash(validate(input) as unknown as Record<string, unknown>);
  return input;
}

describe("validate", () => {
  it("returns a typed rubric with the schema defaults applied", () => {
    const rubric = validate(minimal());
    expect(rubric.questions.residency_met?.cites).toEqual([]);
    expect(rubric.static_state).toEqual({});
    expect(rubric.provenance).toEqual({});
  });

  it("reports every violation, not just the first", () => {
    const input = minimal();
    input.thresholds = { lo: 0.8, hi: 0.7, conf_floor: 0.6 };
    input.routing.rules.push({
      when: { question: "ghost", band: "yes" },
      route: "assessor",
      reason: "unknown question",
    });

    let error: unknown;
    try {
      validate(input);
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(InvalidRubricError);
    const issues = (error as InvalidRubricError).issues;
    expect(issues).toHaveLength(2);
    expect(issues.map((i) => i.path).sort()).toEqual(["routing.rules.1.when", "thresholds"]);
    expect(issues.find((i) => i.path === "thresholds")?.message).toMatch(
      /thresholds\.lo must be less than thresholds\.hi/,
    );
    expect(issues.find((i) => i.path === "routing.rules.1.when")?.message).toMatch(/ghost/);
  });

  it("uses dotted paths with numeric segments", () => {
    const input = minimal();
    input.questions.residency_met = {
      type: "noul",
      instructions: "Is the applicant a resident?",
      required_paths: ["applicant.typo"],
    };
    const issues = collect(input);
    expect(issues[0]?.path).toBe("questions.residency_met.required_paths.0");
  });

  it("rejects non-object input", () => {
    expect(() => validate("not a rubric")).toThrow(InvalidRubricError);
    expect(() => validate(null)).toThrow(InvalidRubricError);
  });
});

function collect(input: unknown) {
  try {
    validate(input);
  } catch (error) {
    return (error as InvalidRubricError).issues;
  }
  throw new Error("expected validate to throw");
}

describe("validateWithHash", () => {
  it("accepts a document whose content_hash matches", () => {
    const rubric = validateWithHash(sealed());
    expect(rubric.scheme).toBe("demo");
  });

  it("is indifferent to whether the author wrote the defaults out", () => {
    const explicit = sealed();
    explicit.static_state = {};
    explicit.provenance = {};
    explicit.questions.residency_met = {
      type: "noul",
      instructions: "Is the applicant a resident?",
      required_paths: ["applicant.role"],
      cites: [],
    };
    expect(validateWithHash(explicit).content_hash).toBe(sealed().content_hash);
  });

  it("throws HashMismatchError naming scheme and version when it does not match", () => {
    const input = sealed();
    input.thresholds = { lo: 0.25, hi: 0.7, conf_floor: 0.6 };

    let error: unknown;
    try {
      validateWithHash(input);
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(HashMismatchError);
    const details = (error as HashMismatchError).details;
    expect(details.scheme).toBe("demo");
    expect(details.version).toBe("2026.9.1");
    expect(details.expected).toBe(input.content_hash);
    expect(details.actual).not.toBe(input.content_hash);
  });

  it("reports schema violations before it looks at the hash", () => {
    const input = minimal();
    input.thresholds = { lo: 0.8, hi: 0.7, conf_floor: 0.6 };
    expect(() => validateWithHash(input)).toThrow(InvalidRubricError);
  });
});
