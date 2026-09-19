import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import definition, { input, questions } from "../../fixtures/disaster-grant/rubric.definition.js";
import { defineRubric } from "../authoring/define-rubric.js";
import { BulwarkError, HashMismatchError, InvalidRubricError } from "../rubric/errors.js";
import { hash } from "../rubric/hash.js";
import { buildCommand, buildRubricFile, formatBuildError, loadDefinition } from "./rubric-build.js";

const directories: string[] = [];
async function temporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), "bulwark-build-"));
  directories.push(directory);
  return directory;
}
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});
it("writes the fixture draft in file-store layout with exact JSON bytes", async () => {
  const out = await temporaryDirectory();
  const file = await buildRubricFile(definition, out);
  expect(file).toBe(join(out, "disaster-grant", "2026.9.1.json"));
  expect(await readFile(file, "utf8")).toBe(
    `${JSON.stringify(definition.toArtifact(), null, 2)}\n`,
  );
});
it("propagates all validation issues and creates no artifact for a broken definition", async () => {
  const out = await temporaryDirectory();
  const broken = defineRubric({
    ...input,
    questions: {
      broken: { ...questions.needs_senior, required_paths: ["case.missing", "case.also_missing"] },
    },
    routing: () => [],
  });
  await expect(buildRubricFile(broken, out)).rejects.toBeInstanceOf(InvalidRubricError);
  await expect(readFile(join(out, "disaster-grant", "2026.9.1.json"))).rejects.toMatchObject({
    code: "ENOENT",
  });
  try {
    broken.toArtifact();
  } catch (error) {
    expect(formatBuildError(error).split("\n")).toEqual([
      'questions.broken.required_paths.0: required path "case.missing" does not resolve in state_schema or static_state',
      'questions.broken.required_paths.1: required path "case.also_missing" does not resolve in state_schema or static_state',
    ]);
  }
});
it("refuses to overwrite an existing artifact unless forced", async () => {
  const out = await temporaryDirectory();
  const file = await buildRubricFile(definition, out);
  await writeFile(file, "keep me\n");
  await expect(buildRubricFile(definition, out)).rejects.toThrow("already exists");
  expect(await readFile(file, "utf8")).toBe("keep me\n");
  await buildRubricFile(definition, out, { force: true });
  expect(await readFile(file, "utf8")).toBe(
    `${JSON.stringify(definition.toArtifact(), null, 2)}\n`,
  );
});
it("re-validates what the module returns and refuses a forged published artifact", async () => {
  const out = await temporaryDirectory();
  const published = {
    ...definition.toArtifact(),
    status: "published",
    provenance: {
      approved_by: "intruder",
      approved_at: "2026-09-19T00:00:00+00:00",
      golden_eval_result: "pass",
    },
  };
  published.content_hash = hash(published);
  const forged = { toArtifact: () => published } as unknown as typeof definition;
  await expect(buildRubricFile(forged, out)).rejects.toThrow('status "draft"');
  const garbage = {
    toArtifact: () => ({ scheme: "demo", version: "1" }),
  } as unknown as typeof definition;
  await expect(buildRubricFile(garbage, out)).rejects.toBeInstanceOf(InvalidRubricError);
  const wrongHash = {
    toArtifact: () => ({ ...definition.toArtifact(), content_hash: `sha256:${"1".repeat(64)}` }),
  } as unknown as typeof definition;
  await expect(buildRubricFile(wrongHash, out)).rejects.toBeInstanceOf(HashMismatchError);
});
it("refuses a scheme directory that is a symlink out of --out", async () => {
  const out = await temporaryDirectory();
  const elsewhere = await temporaryDirectory();
  const { symlink } = await import("node:fs/promises");
  await symlink(elsewhere, join(out, "disaster-grant"));
  await expect(buildRubricFile(definition, out)).rejects.toThrow("outside");
  await expect(readFile(join(elsewhere, "2026.9.1.json"))).rejects.toMatchObject({
    code: "ENOENT",
  });
});
it.each(["export const value = {};", "export default {};", "export default { toArtifact: 1 };"])(
  "rejects a module without a usable default definition: %s",
  async (source) => {
    const out = await temporaryDirectory();
    const file = join(out, "invalid definition.mjs");
    await writeFile(file, source);
    await expect(loadDefinition(file)).rejects.toBeInstanceOf(BulwarkError);
    await expect(buildCommand({ file, out })).rejects.toThrow("default export");
  },
);
it("loads a definition module through an absolute file URL", async () => {
  const out = await temporaryDirectory();
  const file = join(out, "valid definition.mjs");
  await writeFile(
    file,
    `export default { toArtifact() { return ${JSON.stringify(definition.toArtifact())}; } };`,
  );
  expect(await readFile(await buildCommand({ file, out }), "utf8")).toBe(
    `${JSON.stringify(definition.toArtifact(), null, 2)}\n`,
  );
});
it("formats named Bulwark errors", () => {
  const error = new HashMismatchError("scheme", "1", "expected", "actual");
  expect(formatBuildError(error)).toBe(`HashMismatchError: ${error.message}`);
  expect(formatBuildError(new BulwarkError("bad"))).toBe("BulwarkError: bad");
});
it("rejects path traversal in artifact identifiers", async () => {
  const out = await temporaryDirectory();
  await expect(
    buildRubricFile(defineRubric({ ...input, scheme: "../escape", routing: () => [] }), out),
  ).rejects.toThrow("safe file path components");
});
