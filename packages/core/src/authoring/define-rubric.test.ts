import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";
import definition, { input, questions } from "../../fixtures/disaster-grant/rubric.definition.js";
import { InvalidRubricError } from "../rubric/errors.js";
import { validateWithHash } from "../rubric/validate.js";
import { defineRubric } from "./define-rubric.js";
import { routingAccessors } from "./routing-builder.js";
import type { RubricDefinitionInput } from "./types.js";

function brokenDefinition() {
  return defineRubric({
    ...input,
    questions: {
      broken: { ...questions.needs_senior, required_paths: ["case.missing"] },
    },
    routing: () => [],
  });
}

describe("defineRubric", () => {
  it("emits a validated draft with Zod's default JSON Schema", () => {
    const artifact = definition.toArtifact();
    expect(validateWithHash(artifact)).toEqual(artifact);
    expect(artifact.state_schema).toEqual(z.toJSONSchema(input.state));
    expect(artifact.status).toBe("draft");
    expect(artifact.provenance).toEqual({});
  });
  it("turns a Zod shape JSON Schema cannot express into a typed issue", () => {
    const withDate = defineRubric({
      ...input,
      state: input.state.extend({ when: z.date() }),
      routing: () => [],
    });
    let caught: unknown;
    try {
      withDate.toArtifact();
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(InvalidRubricError);
    expect((caught as InvalidRubricError).issues[0]?.path).toBe("state_schema");
  });
  it.each([
    ["union", z.union([z.string(), z.object({ x: z.string() })])],
    ["nullable object", z.object({ x: z.string() }).nullable()],
    ["tuple", z.tuple([z.object({ x: z.string() })])],
    ["constrained record", z.record(z.string().min(1), z.string())],
  ])("refuses a state schema containing a %s the path walker cannot resolve", (_name, field) => {
    const definition = defineRubric({
      ...input,
      state: input.state.extend({ v: field }),
      routing: () => [],
    });
    let caught: unknown;
    try {
      definition.toArtifact();
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(InvalidRubricError);
    expect(
      (caught as InvalidRubricError).issues.every((i) => i.path.startsWith("state_schema")),
    ).toBe(true);
  });
  it("snapshots static state as JSON so live values cannot skew the hash", () => {
    let reads = 0;
    const live = {
      get counter() {
        reads += 1;
        return reads;
      },
    };
    const artifact = defineRubric({
      ...input,
      static: { ...input.static, live },
      routing: () => [],
    }).toArtifact();
    expect(validateWithHash(artifact)).toEqual(artifact);
    expect((artifact.static_state.live as { counter: number }).counter).toBe(1);
    const bigint = defineRubric({
      ...input,
      static: { ...input.static, big: 1n },
      routing: () => [],
    });
    expect(() => bigint.toArtifact()).toThrow(InvalidRubricError);
  });
  it("gives every rule its own condition object", () => {
    const q = routingAccessors(questions);
    const pendingRule = q.needs_senior.band("yes");
    const first = pendingRule.route("assessor", "one");
    const second = pendingRule.route("request_info", "two");
    (first.when as { question: string }).question = "tampered";
    expect(second.when.question).toBe("needs_senior");
  });
  it("rejects required paths missing from the Zod schema", () => {
    expect(() => brokenDefinition().toArtifact()).toThrow(InvalidRubricError);
  });
  it("ignores runtime lifecycle fields and recomputes the hash", () => {
    const clean = { ...input, routing: () => [] };
    const injected = {
      ...clean,
      status: "published",
      content_hash: "fake",
      provenance: { approved_by: "intruder" },
    };
    const artifact = defineRubric(injected).toArtifact();
    expect(artifact).toEqual(defineRubric(clean).toArtifact());
    expect(validateWithHash(artifact)).toEqual(artifact);
  });
  it("defaults static state and preserves supersedes", () => {
    const artifact = defineRubric({
      scheme: "minimal",
      version: "2",
      supersedes: "1",
      model_pin: "pin",
      state: z.object({}),
      questions: {},
      thresholds: input.thresholds,
      routing: () => [],
      default: "assessor",
    }).toArtifact();
    expect(artifact.static_state).toEqual({});
    expect(artifact.supersedes).toBe("1");
  });
  it("has no lifecycle fields in the input type", () => {
    type Input = RubricDefinitionInput<typeof questions, typeof input.state>;
    expectTypeOf<
      Extract<keyof Input, "provenance" | "content_hash" | "status">
    >().toEqualTypeOf<never>();
    expectTypeOf<Input["default"]>().toEqualTypeOf<"assessor" | "request_info" | "auto_approve">();
    const invalid: Input = {
      ...input,
      routing: () => [],
      // @ts-expect-error A default decline is forbidden.
      default: "auto_decline",
    };
    expect(invalid.default).toBe("auto_decline");
  });
  it("exposes only each primitive's condition methods and literal labels", () => {
    const q = routingAccessors(questions);
    expectTypeOf(
      q.needs_senior.band("yes").route("assessor", "reason").when.question,
    ).toEqualTypeOf<"needs_senior">();
    // @ts-expect-error Noul has no equals method.
    expect(q.needs_senior.equals).toBeUndefined();
    // @ts-expect-error Unknown ids are absent at runtime too.
    expect(q.unknown).toBeUndefined();
    expect(q.constructor).toBeUndefined();
    // @ts-expect-error Choice labels are literal keys.
    q.insurance_overlap.equals("not_a_label");
    expect(Object.keys(q.evidence_quality)).toEqual([
      "confidenceBelow",
      "scoreBelow",
      "scoreAbove",
    ]);
    expect(q.insurance_overlap.confidenceBelow().route("assessor", "low").when).toEqual({
      question: "insurance_overlap",
      confidence_below: true,
    });
    expect(q.evidence_quality.confidenceBelow(0).route("assessor", "low").when).toEqual({
      question: "evidence_quality",
      confidence_below: 0,
    });
  });
  it("delegates invalid numeric conditions to rubric validation", () => {
    expect(() =>
      defineRubric({
        ...input,
        routing: (q) => [q.evidence_quality.scoreAbove(99).route("assessor", "bad")],
      }).toArtifact(),
    ).toThrow(InvalidRubricError);
  });
});
