import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { canonicalJson, hash, stripVolatileFields, VOLATILE_FIELDS } from "./hash.js";

/** A rubric-shaped document, small enough to reorder by hand. */
function doc(): Record<string, unknown> {
  return {
    scheme: "demo",
    version: "2026.9.1",
    status: "draft",
    content_hash: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
    thresholds: { lo: 0.3, hi: 0.7, conf_floor: 0.6 },
    questions: { a: { type: "noul", instructions: "?", cites: [], required_paths: [] } },
    provenance: { golden_eval_id: "eval-1", researcher_model: "claude-opus-5" },
  };
}

describe("canonicalJson", () => {
  it("encodes sparse array holes as null, like JSON.stringify", () => {
    expect(canonicalJson(Array(2))).toBe("[null,null]");
    const holey: unknown[] = [1];
    holey[2] = 3;
    expect(canonicalJson(holey)).toBe("[1,null,3]");
  });

  it("sorts object keys recursively and keeps array order", () => {
    expect(canonicalJson({ b: 1, a: [3, { d: true, c: null }] })).toBe(
      '{"a":[3,{"c":null,"d":true}],"b":1}',
    );
  });

  it("omits undefined object values, as JSON.stringify does", () => {
    expect(canonicalJson({ a: undefined, b: 1 })).toBe('{"b":1}');
  });

  it("formats scalars the way JSON.stringify formats them", () => {
    expect(canonicalJson(1.5)).toBe("1.5");
    expect(canonicalJson('x"y')).toBe('"x\\"y"');
    expect(canonicalJson(null)).toBe("null");
    expect(canonicalJson(false)).toBe("false");
  });
});

describe("stripVolatileFields", () => {
  it("names the volatile fields", () => {
    expect(VOLATILE_FIELDS).toEqual(["status", "provenance.approved_by", "provenance.approved_at"]);
  });

  it("removes status, content_hash, and the approval fields only", () => {
    const input = doc();
    input.provenance = {
      golden_eval_id: "eval-1",
      approved_by: "someone",
      approved_at: "2026-09-19T00:00:00+00:00",
    };
    const stripped = stripVolatileFields(input);
    expect(stripped.status).toBeUndefined();
    expect(stripped.content_hash).toBeUndefined();
    expect(stripped.provenance).toEqual({ golden_eval_id: "eval-1" });
    expect(stripped.scheme).toBe("demo");
  });

  it("does not mutate its input", () => {
    const input = doc();
    const before = JSON.stringify(input);
    stripVolatileFields(input);
    expect(JSON.stringify(input)).toBe(before);
  });

  it("tolerates a missing provenance object", () => {
    const { provenance: _provenance, ...rest } = doc();
    expect(stripVolatileFields(rest).provenance).toBeUndefined();
  });
});

describe("hash", () => {
  it("ignores key order, status, approval fields, and content_hash", () => {
    const a = doc();
    a.status = "draft";
    a.provenance = { golden_eval_id: "eval-1", researcher_model: "claude-opus-5" };

    const b: Record<string, unknown> = {
      provenance: {
        researcher_model: "claude-opus-5",
        approved_by: "policy.owner@example.gov",
        approved_at: "2026-09-19T00:00:00+00:00",
        golden_eval_id: "eval-1",
      },
      questions: { a: { required_paths: [], cites: [], instructions: "?", type: "noul" } },
      thresholds: { conf_floor: 0.6, hi: 0.7, lo: 0.3 },
      content_hash: "sha256:1111111111111111111111111111111111111111111111111111111111111111",
      status: "published",
      version: "2026.9.1",
      scheme: "demo",
    };

    expect(hash(b)).toBe(hash(a));
  });

  it("changes when a threshold changes", () => {
    const a = doc();
    const b = doc();
    b.thresholds = { lo: 0.31, hi: 0.7, conf_floor: 0.6 };
    expect(hash(b)).not.toBe(hash(a));
  });

  it("is sha256 over the canonical string: known vector for {}", () => {
    expect(hash({})).toBe(
      "sha256:44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a",
    );
  });

  it("matches a digest computed independently from the literal canonical string", () => {
    const canonical = '{"a":[3,{"c":null,"d":true}],"b":1}';
    const expected = `sha256:${createHash("sha256").update(canonical, "utf8").digest("hex")}`;
    expect(hash({ b: 1, a: [3, { d: true, c: null }] })).toBe(expected);
  });

  it("returns sha256 followed by 64 lowercase hex characters", () => {
    expect(hash(doc())).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});
