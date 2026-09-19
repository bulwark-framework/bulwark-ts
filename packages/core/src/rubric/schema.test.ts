import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parsePath, pathResolves, type RubricInput, rubricSchema } from "./schema.js";

const here = dirname(fileURLToPath(import.meta.url));
const designDoc = resolve(here, "../../../../docs/design-docs/rubric-artifact.md");

/** The first ```json block of the design doc is the canonical example. */
function loadExample(): RubricInput {
  const md = readFileSync(designDoc, "utf8");
  const block = /```json\n([\s\S]*?)```/.exec(md);
  if (!block?.[1]) throw new Error(`no json block in ${designDoc}`);
  return JSON.parse(block[1]) as RubricInput;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function messages(input: unknown): string[] {
  const result = rubricSchema.safeParse(input);
  if (result.success) return [];
  return result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
}

describe("rubric schema: design-doc example", () => {
  it("validates the example in rubric-artifact.md", () => {
    const result = rubricSchema.safeParse(loadExample());
    expect(result.success, JSON.stringify(result.error?.issues, null, 2)).toBe(true);
  });

  it("applies defaults: no_match label, cites, required_paths, provenance", () => {
    const rubric = rubricSchema.parse(loadExample());
    const step = rubric.questions.activity_step;
    expect(step?.type).toBe("choice");
    if (step?.type === "choice") expect(step.no_match).toBe("none_of_the_above");
    expect(rubric.questions.activity_step?.required_paths).toEqual([]);
  });

  it("accepts the optional provenance fields for compiled rubrics", () => {
    const rubric = rubricSchema.parse(loadExample());
    expect(rubric.provenance.corpus_index_ref).toMatch(/^idx-/);
    expect(rubric.provenance.researcher_model).toBeTruthy();
    expect(rubric.provenance.contextualiser_model).toBeTruthy();
  });

  it("accepts a hand-authored draft with no provenance", () => {
    const input = clone(loadExample());
    delete (input as { provenance?: unknown }).provenance;
    input.status = "draft";
    expect(messages(input)).toEqual([]);
  });

  it("rejects a published rubric without eval pass and a named approver (invariant 4)", () => {
    const input = clone(loadExample());
    delete (input as { provenance?: unknown }).provenance;
    expect(messages(input)).toEqual([
      expect.stringMatching(/^provenance\.golden_eval_result/),
      expect.stringMatching(/^provenance\.approved_by/),
      expect.stringMatching(/^provenance\.approved_at/),
    ]);
  });

  it("requires content_hash to be sha256 plus 64 hex", () => {
    const input = clone(loadExample());
    input.content_hash = "sha256:9f2c…";
    expect(messages(input)).toEqual([expect.stringMatching(/^content_hash/)]);
  });

  it("accepts an offset timestamp in approved_at", () => {
    const input = clone(loadExample());
    input.provenance = { ...input.provenance, approved_at: "2026-09-14T22:41:00+10:00" };
    expect(messages(input)).toEqual([]);
  });
});

describe("rubric schema: structural rules", () => {
  it("rejects a Choice without a no-match label", () => {
    const input = clone(loadExample());
    const step = input.questions.activity_step;
    if (step?.type !== "choice") throw new Error("fixture changed");
    delete step.criteria.none_of_the_above;
    expect(messages(input)).toEqual([
      expect.stringContaining('no no-match label "none_of_the_above"'),
    ]);
  });

  it("accepts a Choice whose no-match label is declared explicitly", () => {
    const input = clone(loadExample());
    const step = input.questions.activity_step;
    if (step?.type !== "choice") throw new Error("fixture changed");
    delete step.criteria.none_of_the_above;
    step.criteria.other = "no listed step applies";
    step.no_match = "other";
    expect(messages(input)).toEqual([]);
  });

  it("rejects a required path absent from state_schema and static_state", () => {
    const input = clone(loadExample());
    input.state_schema = { properties: { applicant: { properties: { name: {} } } } };
    const q = input.questions.residency_met;
    if (!q) throw new Error("fixture changed");
    q.required_paths = ["applicant.residency", "nowhere.at_all"];
    const msgs = messages(input);
    expect(msgs).toHaveLength(2);
    expect(msgs[0]).toContain('"applicant.residency" does not resolve');
    expect(msgs[1]).toContain('"nowhere.at_all" does not resolve');
  });

  it("accepts a required path that lands in static_state", () => {
    const input = clone(loadExample());
    const q = input.questions.residency_met;
    if (!q) throw new Error("fixture changed");
    q.required_paths = ["policy.eligibility_s85BA"];
    expect(messages(input)).toEqual([]);
  });

  it("rejects missing threshold keys", () => {
    const input = clone(loadExample());
    (input as { thresholds: Partial<RubricInput["thresholds"]> }).thresholds = { lo: 0.3 };
    const msgs = messages(input);
    expect(msgs.some((m) => m.startsWith("thresholds.hi"))).toBe(true);
    expect(msgs.some((m) => m.startsWith("thresholds.conf_floor"))).toBe(true);
  });

  it("rejects lo >= hi", () => {
    const input = clone(loadExample());
    input.thresholds = { lo: 0.7, hi: 0.3, conf_floor: 0.6 };
    expect(messages(input)).toEqual([expect.stringContaining("lo must be less than")]);
  });

  it("rejects a routing rule that references an unknown question", () => {
    const input = clone(loadExample());
    input.routing.rules.push({
      when: { question: "typo_id", band: "no" },
      route: "assessor",
      reason: "x",
    });
    expect(messages(input)).toEqual([expect.stringContaining('unknown question "typo_id"')]);
  });

  it("rejects a condition kind that does not fit the question type", () => {
    const input = clone(loadExample());
    input.routing.rules.push({
      when: { question: "residency_met", score_below: 1 },
      route: "assessor",
      reason: "x",
    });
    expect(messages(input)).toEqual([
      expect.stringContaining('condition "score_below" does not fit a noul'),
    ]);
  });

  it("rejects equals with a label that is not a criterion", () => {
    const input = clone(loadExample());
    input.routing.rules.push({
      when: { question: "activity_step", equals: "step_9" },
      route: "assessor",
      reason: "x",
    });
    expect(messages(input)).toEqual([expect.stringContaining('label "step_9" is not a criterion')]);
  });

  it("rejects a score level outside the criteria range", () => {
    const input = clone(loadExample());
    input.routing.rules.push(
      { when: { question: "evidence_quality", score_below: 99 }, route: "assessor", reason: "x" },
      { when: { question: "evidence_quality", score_above: -1 }, route: "assessor", reason: "x" },
    );
    const msgs = messages(input);
    expect(msgs).toHaveLength(2);
    expect(msgs[0]).toContain("level 99 is outside 0..3");
    expect(msgs[1]).toContain("level -1 is outside 0..3");
  });

  it("does not resolve prototype keys as required paths", () => {
    const input = clone(loadExample());
    input.state_schema = { properties: { applicant: { properties: { name: {} } } } };
    const q = input.questions.residency_met;
    if (!q) throw new Error("fixture changed");
    q.required_paths = ["applicant.constructor", "toString", "policy.hasOwnProperty"];
    expect(messages(input)).toHaveLength(3);
  });

  it("rejects a Noul criteria object with unknown keys", () => {
    const input = clone(loadExample());
    const q = input.questions.residency_met;
    if (q?.type !== "noul") throw new Error("fixture changed");
    (q as { criteria: unknown }).criteria = { tru: "typo" };
    expect(messages(input)).toEqual([expect.stringMatching(/^questions\.residency_met\.criteria/)]);
  });

  it("accepts null as a criterion description, as the SDK does", () => {
    const input = clone(loadExample());
    const q = input.questions.activity_step;
    if (q?.type !== "choice") throw new Error("fixture changed");
    q.criteria.step_0 = null;
    expect(messages(input)).toEqual([]);
  });

  it("rejects a rule with two condition keys", () => {
    const input = clone(loadExample());
    input.routing.rules.push({
      when: { question: "residency_met", band: "no", score_below: 1 } as never,
      route: "assessor",
      reason: "x",
    });
    expect(messages(input).length).toBeGreaterThan(0);
  });

  it("rejects auto_decline as the default route", () => {
    const input = clone(loadExample());
    (input.routing as { default: string }).default = "auto_decline";
    expect(messages(input)).toEqual([expect.stringMatching(/^routing\.default/)]);
  });

  it("accepts auto_decline as a rule route", () => {
    const rubric = rubricSchema.parse(loadExample());
    expect(rubric.routing.rules.some((r) => r.route === "auto_decline")).toBe(true);
  });

  it("rejects supersedes equal to version", () => {
    const input = clone(loadExample());
    input.supersedes = input.version;
    expect(messages(input)).toEqual([expect.stringContaining("supersedes must not equal")]);
  });

  it("rejects a Score with fewer than two levels", () => {
    const input = clone(loadExample());
    const q = input.questions.evidence_quality;
    if (q?.type !== "score") throw new Error("fixture changed");
    q.criteria = ["only one"];
    expect(messages(input)[0]).toMatch(/^questions\.evidence_quality\.criteria/);
  });

  it("reports every structural violation, not only the first", () => {
    const input = clone(loadExample());
    input.thresholds = { lo: 0.7, hi: 0.3, conf_floor: 0.6 };
    input.supersedes = input.version;
    expect(messages(input)).toHaveLength(2);
  });
});

describe("path resolution", () => {
  it("parses dot and index segments", () => {
    expect(parsePath("a.b[0].c[1][2]")).toEqual(["a", "b", 0, "c", 1, 2]);
    expect(parsePath("")).toEqual([]);
    expect(parsePath("a..b")).toEqual([]);
  });

  it("walks properties and items", () => {
    const schema = {
      properties: {
        activity: {
          properties: { evidence: { items: { properties: { kind: {} } } } },
          additionalProperties: false,
        },
      },
    };
    expect(pathResolves("activity.evidence[0].kind", schema, {})).toBe(true);
    expect(pathResolves("activity.evidence[0].nope", schema, {})).toBe(false); // declared props
    expect(pathResolves("activity.other", schema, {})).toBe(false);
    expect(
      pathResolves("open.anything", { properties: { open: { additionalProperties: true } } }, {}),
    ).toBe(true);
    expect(pathResolves("missing", { properties: {}, additionalProperties: false }, {})).toBe(
      false,
    );
  });

  it("handles boolean subschemas and tuple items", () => {
    const schema = {
      properties: {
        open: true,
        closed: false,
        pair: { items: [{ properties: { a: {} }, additionalProperties: false }, {}] },
      },
    };
    expect(pathResolves("open.anything.at.all", schema, {})).toBe(true);
    expect(pathResolves("closed", schema, {})).toBe(false);
    expect(pathResolves("pair[0].a", schema, {})).toBe(true);
    expect(pathResolves("pair[0].b", schema, {})).toBe(false);
    expect(pathResolves("pair[1].whatever", schema, {})).toBe(true);
    expect(pathResolves("pair[2]", schema, {})).toBe(false);
  });

  it("treats a schema with no constraints as permissive", () => {
    expect(pathResolves("anything.goes[3]", {}, {})).toBe(true);
    expect(pathResolves("applicant.residency", { properties: { applicant: {} } }, {})).toBe(true);
  });

  it("falls back to static_state values", () => {
    expect(
      pathResolves(
        "policy.x",
        { properties: {}, additionalProperties: false },
        { policy: { x: 1 } },
      ),
    ).toBe(true);
    expect(
      pathResolves(
        "policy.y",
        { properties: {}, additionalProperties: false },
        { policy: { x: 1 } },
      ),
    ).toBe(false);
  });
});
