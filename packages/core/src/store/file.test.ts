import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { HashMismatchError, InvalidRubricError, RubricNotFoundError } from "../rubric/index.js";
import { FileRubricStore } from "./file.js";
import { loadFixture, variant } from "./test-helpers.js";

const base = loadFixture();

describe("FileRubricStore", () => {
  let root: string;
  let store: FileRubricStore;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "bulwark-store-"));
    store = new FileRubricStore(root);
    await store.put(variant(base, { version: "2026.9.1", status: "published" }));
    await store.put(variant(base, { version: "2026.10.1", status: "draft" }));
    await store.put(variant(base, { version: "2026.9.10", status: "published" }));
    await store.put(variant(base, { version: "2026.11.1", status: "candidate" }));
    await store.put(variant(base, { version: "2026.12.1", status: "deprecated" }));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("leaves no temporary files behind after a write", async () => {
    const { readdir } = await import("node:fs/promises");
    const entries = await readdir(join(root, "disaster-grant"));
    expect(entries.filter((e) => e.endsWith(".tmp"))).toEqual([]);
    expect(entries).toHaveLength(5);
  });

  it("writes one file per version and reads them back", async () => {
    const path = join(root, "disaster-grant", "2026.9.10.json");
    expect((await readFile(path, "utf8")).endsWith("\n")).toBe(true);
    await expect(store.get("disaster-grant", "2026.9.10")).resolves.toMatchObject({
      version: "2026.9.10",
      status: "published",
    });
  });

  it("returns the highest published version and ignores the others", async () => {
    const latest = await store.latestPublished("disaster-grant");
    expect(latest.version).toBe("2026.9.10");
  });

  it("throws RubricNotFoundError for an unknown version", async () => {
    const error = await store.get("disaster-grant", "1999.1.1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RubricNotFoundError);
    expect((error as RubricNotFoundError).details).toMatchObject({
      scheme: "disaster-grant",
      version: "1999.1.1",
    });
  });

  it("throws RubricNotFoundError for an unknown scheme directory", async () => {
    await expect(store.get("no-such-scheme", "2026.9.1")).rejects.toBeInstanceOf(
      RubricNotFoundError,
    );
    const error = await store.latestPublished("no-such-scheme").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RubricNotFoundError);
    expect((error as RubricNotFoundError).details).toMatchObject({
      scheme: "no-such-scheme",
      version: "latest-published",
    });
  });

  describe("a file edited on disk after it was written", () => {
    beforeEach(async () => {
      const path = join(root, "disaster-grant", "2026.9.10.json");
      const document = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
      (document.thresholds as Record<string, unknown>).lo = 0.31;
      await writeFile(path, `${JSON.stringify(document, null, 2)}\n`, "utf8");
    });

    it("get throws HashMismatchError naming scheme and version", async () => {
      const error = await store.get("disaster-grant", "2026.9.10").catch((e: unknown) => e);
      expect(error).toBeInstanceOf(HashMismatchError);
      expect((error as HashMismatchError).details).toMatchObject({
        scheme: "disaster-grant",
        version: "2026.9.10",
      });
    });

    it("latestPublished throws rather than skipping the tampered file", async () => {
      await expect(store.latestPublished("disaster-grant")).rejects.toBeInstanceOf(
        HashMismatchError,
      );
    });
  });

  it("throws InvalidRubricError when a file's content disagrees with its name", async () => {
    const misfiled = variant(base, { version: "2026.9.1", status: "published" });
    await writeFile(
      join(root, "disaster-grant", "2026.9.99.json"),
      `${JSON.stringify(misfiled)}\n`,
      "utf8",
    );
    const error = await store.get("disaster-grant", "2026.9.99").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(InvalidRubricError);
    expect((error as InvalidRubricError).issues).toEqual([
      expect.objectContaining({ path: "version" }),
    ]);
    await expect(store.latestPublished("disaster-grant")).rejects.toBeInstanceOf(
      InvalidRubricError,
    );
  });

  it("throws InvalidRubricError for a file that is not JSON", async () => {
    await writeFile(join(root, "disaster-grant", "2026.9.11.json"), "{ not json", "utf8");
    const error = await store.get("disaster-grant", "2026.9.11").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(InvalidRubricError);
    expect((error as InvalidRubricError).issues).toHaveLength(1);
    expect((error as InvalidRubricError).issues[0]?.path).toBe("");
  });

  it("throws InvalidRubricError for a file that is JSON but not a rubric", async () => {
    await writeFile(join(root, "disaster-grant", "2026.9.12.json"), '{"scheme":"x"}', "utf8");
    await expect(store.get("disaster-grant", "2026.9.12")).rejects.toBeInstanceOf(
      InvalidRubricError,
    );
  });

  it("rejects a scheme or version that is not a usable path segment", async () => {
    await expect(store.get("..", "2026.9.1")).rejects.toBeInstanceOf(TypeError);
    await expect(store.get("a/b", "2026.9.1")).rejects.toBeInstanceOf(TypeError);
    await expect(store.get("disaster-grant", "..")).rejects.toBeInstanceOf(TypeError);
    await expect(store.get("disaster-grant", "a/b")).rejects.toBeInstanceOf(TypeError);
    await expect(store.latestPublished("a\\b")).rejects.toBeInstanceOf(TypeError);
  });
});
