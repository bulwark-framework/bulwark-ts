import { mkdir, realpath, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { RubricDefinition } from "../authoring/types.js";
import { BulwarkError, InvalidRubricError } from "../rubric/errors.js";
import { validateWithHash } from "../rubric/validate.js";

export async function loadDefinition(file: string): Promise<RubricDefinition> {
  const module: { default?: unknown } = await import(pathToFileURL(resolve(file)).href);
  const definition = module.default;
  if (
    definition === null ||
    typeof definition !== "object" ||
    !("toArtifact" in definition) ||
    typeof definition.toArtifact !== "function"
  ) {
    throw new BulwarkError("definition must have a default export with a toArtifact() method");
  }
  return definition as RubricDefinition;
}

export interface BuildOptions {
  /** Replace an existing artifact file. Default: refuse, so a build never clobbers a version. */
  force?: boolean;
}

export async function buildRubricFile(
  definition: RubricDefinition,
  outDir: string,
  options: BuildOptions = {},
): Promise<string> {
  // The CLI trusts nothing the module returns: re-validate the exact payload
  // that will be written and insist on a draft. Publishing is the approval
  // gate's job, never a build step.
  const artifact = validateWithHash(JSON.parse(JSON.stringify(definition.toArtifact())));
  if (artifact.status !== "draft") {
    throw new BulwarkError(`a built artifact must have status "draft", got "${artifact.status}"`, {
      status: artifact.status,
    });
  }
  for (const value of [artifact.scheme, artifact.version]) {
    if (value.length === 0 || /[/\\]|^\.\.?$/.test(value)) {
      throw new BulwarkError("scheme and version must be safe file path components");
    }
  }
  await mkdir(outDir, { recursive: true });
  const root = await realpath(outDir);
  const directory = join(outDir, artifact.scheme);
  await mkdir(directory, { recursive: true });
  // A scheme directory that is a symlink out of --out is refused.
  const realDirectory = await realpath(directory);
  const rel = relative(root, realDirectory);
  if (rel.startsWith("..") || resolve(root, rel) !== realDirectory) {
    throw new BulwarkError(
      `refusing to write outside ${outDir}: ${directory} resolves to ${realDirectory}`,
    );
  }
  const file = join(directory, `${artifact.version}.json`);
  const flag = options.force ? "w" : "wx";
  try {
    await writeFile(file, `${JSON.stringify(artifact, null, 2)}\n`, { encoding: "utf8", flag });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new BulwarkError(`${file} already exists; pass --force to replace it`, { file });
    }
    throw error;
  }
  return file;
}

export async function buildCommand({
  file,
  out,
  force,
}: {
  file: string;
  out: string;
  force?: boolean;
}): Promise<string> {
  return buildRubricFile(await loadDefinition(file), out, { force: force ?? false });
}

export function formatBuildError(error: unknown): string {
  if (error instanceof InvalidRubricError) {
    return error.issues.map(({ path, message }) => `${path}: ${message}`).join("\n");
  }
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}
