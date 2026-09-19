import { beforeEach, describe, expect, it } from "vitest";
import { HashMismatchError, InvalidRubricError, RubricNotFoundError } from "../rubric/index.js";
import { MemoryRubricStore } from "./memory.js";
import { loadFixture, variant } from "./test-helpers.js";

const base = loadFixture();

/**
 * Two published versions either side of a numerically-ordered boundary, plus
 * one of every non-published status at a higher version. `latestPublished`
 * must pick `2026.9.10` and ignore the rest.
 */
function seedRubrics(): unknown[] {
  return [
    variant(base, { version: "2026.9.1", status: "published" }),
    variant(base, { version: "2026.10.1", status: "draft" }),
    variant(base, { version: "2026.9.10", status: "published" }),
    variant(base, { version: "2026.11.1", status: "candidate" }),
    variant(base, { version: "2026.12.1", status: "deprecated" }),
  ];
}

describe("MemoryRubricStore", () => {
  let store: MemoryRubricStore;

  beforeEach(() => {
    store = new MemoryRubricStore(seedRubrics());
  });

  it("isolates stored documents from caller mutation", async () => {
    const seed = variant(base, { version: "2026.9.1", status: "published" });
    const local = new MemoryRubricStore();
    const returned = await local.put(seed);
    seed.thresholds.lo = 0.01;
    returned.thresholds.hi = 0.99;
    const first = await local.get("disaster-grant", "2026.9.1");
    first.thresholds.conf_floor = 0.5;
    const second = await local.get("disaster-grant", "2026.9.1");
    expect(second.thresholds).toEqual(base.thresholds);
  });

  it("returns the highest published version and ignores the others", async () => {
    const latest = await store.latestPublished("disaster-grant");
    expect(latest.version).toBe("2026.9.10");
    expect(latest.status).toBe("published");
  });

  it("gets an exact version whatever its status", async () => {
    await expect(store.get("disaster-grant", "2026.10.1")).resolves.toMatchObject({
      version: "2026.10.1",
      status: "draft",
    });
  });

  it("throws RubricNotFoundError naming scheme and version for an unknown version", async () => {
    const error = await store.get("disaster-grant", "1999.1.1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RubricNotFoundError);
    expect((error as RubricNotFoundError).details).toMatchObject({
      scheme: "disaster-grant",
      version: "1999.1.1",
    });
  });

  it("throws RubricNotFoundError for an unknown scheme", async () => {
    const error = await store.get("no-such-scheme", "2026.9.1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RubricNotFoundError);
    expect((error as RubricNotFoundError).details).toMatchObject({ scheme: "no-such-scheme" });
  });

  it("throws RubricNotFoundError from latestPublished for an unknown scheme", async () => {
    const error = await store.latestPublished("no-such-scheme").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RubricNotFoundError);
    expect((error as RubricNotFoundError).details).toMatchObject({
      scheme: "no-such-scheme",
      version: "latest-published",
    });
  });

  it("throws RubricNotFoundError from latestPublished when nothing is published", async () => {
    const drafts = new MemoryRubricStore([variant(base, { version: "2026.9.1", status: "draft" })]);
    await expect(drafts.latestPublished("disaster-grant")).rejects.toBeInstanceOf(
      RubricNotFoundError,
    );
  });

  it("put stores, returns the parsed rubric, and overwrites the same version", async () => {
    const added = await store.put(variant(base, { version: "2027.1.1", status: "published" }));
    expect(added.version).toBe("2027.1.1");
    await expect(store.latestPublished("disaster-grant")).resolves.toMatchObject({
      version: "2027.1.1",
    });

    await store.put(variant(base, { version: "2027.1.1", status: "deprecated" }));
    await expect(store.get("disaster-grant", "2027.1.1")).resolves.toMatchObject({
      status: "deprecated",
    });
    await expect(store.latestPublished("disaster-grant")).resolves.toMatchObject({
      version: "2026.9.10",
    });
  });

  it("put rejects a tampered content_hash with HashMismatchError", async () => {
    const tampered = {
      ...variant(base, { version: "2027.2.1", status: "published" }),
      content_hash: `sha256:${"a".repeat(64)}`,
    };
    const error = await store.put(tampered).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HashMismatchError);
    expect((error as HashMismatchError).details).toMatchObject({
      scheme: "disaster-grant",
      version: "2027.2.1",
    });
  });

  it("put rejects an invalid rubric with InvalidRubricError", async () => {
    const invalid = { ...variant(base, { version: "2027.3.1" }), model_pin: "" };
    await expect(store.put(invalid)).rejects.toBeInstanceOf(InvalidRubricError);
  });

  it("rejects a bad seed at construction", () => {
    expect(() => new MemoryRubricStore([{ scheme: "disaster-grant" }])).toThrow(InvalidRubricError);
  });
});
