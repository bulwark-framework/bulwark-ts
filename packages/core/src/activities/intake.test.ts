import { describe, expect, it, vi } from "vitest";
import { loadFixture } from "../store/test-helpers.js";
import { intake, passthroughIntake } from "./intake.js";
import type { IntakeInput } from "./types.js";

const business = {
  abn: "12345678901",
  abn_registered_at: "2020-01-01",
  location_lga: "Lismore",
  employee_count: 5,
  annual_turnover_aud: 500000,
};
const input = (): IntakeInput => ({
  caseId: "case-1",
  facet: "business",
  artefacts: { json: business },
  stateSchema: loadFixture().state_schema,
});

describe("intake", () => {
  it("passes a valid business fragment without copying", async () => {
    const result = await intake(passthroughIntake)(input());
    expect(result).toEqual({ facet: "business", fragment: business });
    expect(result.fragment).toBe(business);
  });
  it("reports the nested wrong type and schema path", async () => {
    const value = input();
    value.artefacts.json = { ...business, employee_count: "ten" };
    await expect(intake(passthroughIntake)(value)).rejects.toMatchObject({
      type: "IntakeSchemaViolationError",
      nonRetryable: true,
      message: expect.stringContaining("case-1"),
      details: [
        {
          issues: [
            {
              path: "business.employee_count",
              message: "must be number (schema: #/properties/employee_count/type)",
            },
          ],
        },
      ],
    });
  });
  it.each([true, false, {}, { properties: {} }, { properties: { other: true } }])(
    "rejects an undeclared facet in %j",
    async (stateSchema) => {
      await expect(intake(passthroughIntake)({ ...input(), stateSchema })).rejects.toMatchObject({
        type: "IntakeSchemaViolationError",
        details: [
          {
            issues: [
              { path: "business", message: 'facet "business" is not declared in state_schema' },
            ],
          },
        ],
      });
    },
  );
  it("does not accept inherited facet names", async () => {
    await expect(
      intake(passthroughIntake)({ ...input(), facet: "toString" }),
    ).rejects.toMatchObject({ type: "IntakeSchemaViolationError" });
  });
  it("passthrough returns artefacts.json by identity", async () => {
    expect(await passthroughIntake(input())).toBe(business);
  });
  it("passes the full input to a custom adapter", async () => {
    const value = input();
    const adapter = vi.fn(async () => business);
    expect(await intake(adapter)(value)).toEqual({ facet: "business", fragment: business });
    expect(adapter).toHaveBeenCalledExactlyOnceWith(value);
  });
  it("validates custom adapter output", async () => {
    await expect(
      intake(async () => ({ ...business, employee_count: "ten" }))(input()),
    ).rejects.toMatchObject({ type: "IntakeSchemaViolationError" });
  });
  it("decodes pointer escapes and array indices, collecting all errors", async () => {
    await expect(
      intake(passthroughIntake)({
        ...input(),
        stateSchema: {
          properties: {
            business: {
              type: "object",
              properties: { "a/b~c": { type: "array", items: { type: "number" } } },
            },
          },
        },
        artefacts: { json: { "a/b~c": ["x", "y"] } },
      }),
    ).rejects.toMatchObject({
      details: [
        {
          issues: [
            { path: "business.a/b~c.0", message: expect.stringContaining("must be number") },
            { path: "business.a/b~c.1", message: expect.stringContaining("must be number") },
          ],
        },
      ],
    });
  });
  it("accepts boolean facet schemas", async () => {
    expect(
      await intake(passthroughIntake)({
        ...input(),
        stateSchema: { properties: { business: true } },
      }),
    ).toEqual({ facet: "business", fragment: business });
    await expect(
      intake(passthroughIntake)({ ...input(), stateSchema: { properties: { business: false } } }),
    ).rejects.toMatchObject({ type: "IntakeSchemaViolationError" });
  });
  it('resolves `$ref: "#"` against the state schema root, not the facet', async () => {
    const stateSchema = {
      type: "object",
      required: ["business"],
      properties: {
        business: { type: "object", properties: { child: { $ref: "#" } } },
      },
    };
    await expect(
      intake(passthroughIntake)({ ...input(), stateSchema, artefacts: { json: { child: {} } } }),
    ).rejects.toMatchObject({
      type: "IntakeSchemaViolationError",
      details: [
        {
          issues: [
            { path: "business.child", message: expect.stringContaining("required property") },
          ],
        },
      ],
    });
  });
  it("resolves root `$defs` references", async () => {
    const stateSchema = {
      type: "object",
      $defs: { biz: { type: "object", properties: { n: { type: "number" } } } },
      properties: { business: { $ref: "#/$defs/biz" } },
    };
    await expect(
      intake(passthroughIntake)({ ...input(), stateSchema, artefacts: { json: { n: "x" } } }),
    ).rejects.toMatchObject({
      type: "IntakeSchemaViolationError",
      details: [
        { issues: [{ path: "business.n", message: expect.stringContaining("must be number") }] },
      ],
    });
    expect(
      await intake(passthroughIntake)({ ...input(), stateSchema, artefacts: { json: { n: 1 } } }),
    ).toEqual({ facet: "business", fragment: { n: 1 } });
  });
  it("validates tuple items and ignores format", async () => {
    const stateSchema = {
      properties: {
        business: {
          type: "object",
          properties: {
            pair: {
              type: "array",
              items: [{ type: "number" }, { type: "string", format: "date" }],
            },
          },
        },
      },
    };
    expect(
      await intake(passthroughIntake)({
        ...input(),
        stateSchema,
        artefacts: { json: { pair: [1, "not a date"] } },
      }),
    ).toMatchObject({ facet: "business" });
    await expect(
      intake(passthroughIntake)({
        ...input(),
        stateSchema,
        artefacts: { json: { pair: ["x", "y"] } },
      }),
    ).rejects.toMatchObject({
      details: [
        {
          issues: [{ path: "business.pair.0", message: expect.stringContaining("must be number") }],
        },
      ],
    });
  });
  it("reports an uncompilable facet schema as a non-retryable rubric error", async () => {
    await expect(
      intake(passthroughIntake)({
        ...input(),
        stateSchema: { properties: { business: { type: "object", bogus_keyword: 1 } } },
      }),
    ).rejects.toMatchObject({
      type: "InvalidRubricError",
      nonRetryable: true,
      details: [
        {
          issues: [
            {
              path: "state_schema.properties.business",
              message: expect.stringContaining("unknown keyword"),
            },
          ],
        },
      ],
    });
  });
  it("propagates adapter errors by identity", async () => {
    const error = new TypeError("adapter failed");
    await expect(
      intake(async () => {
        throw error;
      })(input()),
    ).rejects.toBe(error);
  });
});
