import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { IntakeSchemaViolationError } from "../rubric/errors.js";
import { MemoryRubricStore } from "../store/memory.js";
import { fakeClient } from "./decide/test-helpers.js";
import { createActivities } from "./factory.js";
import { ActivityNames, type DecideInput } from "./types.js";

afterEach(() => vi.unstubAllEnvs());
describe("createActivities", () => {
  it("returns exactly the public activity names without needing an env key", () => {
    vi.stubEnv("TYPESAFE_API_KEY", undefined);
    expect(
      Object.keys(
        createActivities({ store: new MemoryRubricStore(), typesafe: fakeClient() }),
      ).sort(),
    ).toEqual([...ActivityNames].sort());
  });
  it.each([undefined, "", "   "])("rejects a missing or blank key (%j) synchronously", (key) => {
    vi.stubEnv("TYPESAFE_API_KEY", key);
    expect(() => createActivities({ store: new MemoryRubricStore() })).toThrow(
      "TYPESAFE_API_KEY is not set; the decide activity needs it in the worker process",
    );
  });
  it("constructs a real client at factory time when a key is present", () => {
    vi.stubEnv("TYPESAFE_API_KEY", "unit-test-not-a-real-key");
    expect(Object.keys(createActivities({ store: new MemoryRubricStore() })).sort()).toEqual(
      [...ActivityNames].sort(),
    );
  });
  it("has no API credential in decide input", () => {
    expectTypeOf<DecideInput>().not.toHaveProperty("apiKey");
  });
  it("wires the default passthrough", async () => {
    const activities = createActivities({ store: new MemoryRubricStore(), typesafe: fakeClient() });
    const json = { name: "business" };
    expect(
      await activities.intake({
        caseId: "case",
        facet: "business",
        artefacts: { json },
        stateSchema: { properties: { business: true } },
      }),
    ).toEqual({ facet: "business", fragment: json });
    await expect(
      activities.resolveRubric({ scheme: "missing", latest: "published" }),
    ).rejects.toMatchObject({ type: "RubricNotFoundError", nonRetryable: true });
  });
  it("wraps custom adapter Bulwark errors", async () => {
    const error = new IntakeSchemaViolationError([{ path: "business", message: "missing" }]);
    const activities = createActivities({
      store: new MemoryRubricStore(),
      typesafe: fakeClient(),
      intake: async () => {
        throw error;
      },
    });
    await expect(
      activities.intake({ caseId: "case", facet: "business", artefacts: {}, stateSchema: true }),
    ).rejects.toMatchObject({ type: error.name, nonRetryable: true, details: [error.details] });
  });
});
