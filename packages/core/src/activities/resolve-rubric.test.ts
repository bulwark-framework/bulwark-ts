import { describe, expect, it } from "vitest";
import { MemoryRubricStore } from "../store/memory.js";
import { loadFixture, variant } from "../store/test-helpers.js";
import { resolveRubric } from "./resolve-rubric.js";

describe("resolveRubric", () => {
  it("resolves the latest published version and records its identity", async () => {
    const store = new MemoryRubricStore();
    const base = loadFixture();
    const latest = variant(base, { version: "2026.9.2", status: "published" });
    await store.put(base);
    await store.put(latest);
    expect(await resolveRubric(store)({ scheme: base.scheme, latest: "published" })).toEqual({
      rubric: latest,
      resolvedVersion: latest.version,
      contentHash: latest.content_hash,
    });
  });
  it("resolves an exact version", async () => {
    const store = new MemoryRubricStore();
    const rubric = await store.put(loadFixture());
    expect(await resolveRubric(store)({ scheme: rubric.scheme, version: rubric.version })).toEqual({
      rubric,
      resolvedVersion: rubric.version,
      contentHash: rubric.content_hash,
    });
  });
  it("re-verifies a store response", async () => {
    const rubric = loadFixture();
    const store = new MemoryRubricStore();
    store.get = async () => ({ ...rubric, content_hash: `sha256:${"0".repeat(64)}` });
    await expect(
      resolveRubric(store)({ scheme: rubric.scheme, version: rubric.version }),
    ).rejects.toMatchObject({ type: "HashMismatchError", nonRetryable: true });
  });
  it("wraps an unknown scheme", async () => {
    await expect(
      resolveRubric(new MemoryRubricStore())({ scheme: "unknown", latest: "published" }),
    ).rejects.toMatchObject({ type: "RubricNotFoundError", nonRetryable: true });
  });
});
