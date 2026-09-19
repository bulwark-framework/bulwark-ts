/**
 * File-backed rubric store: one directory per scheme, one JSON file per
 * version.
 *
 * ```
 * <rootDir>/<scheme>/<version>.json
 * ```
 *
 * Bytes on disk can change between writes, so every read validates the
 * document and checks its `content_hash`. A tampered file is never silently
 * skipped, including by `latestPublished`.
 */
import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  InvalidRubricError,
  type Rubric,
  RubricNotFoundError,
  validateWithHash,
} from "../rubric/index.js";
import { compareVersions, type RubricStore } from "./types.js";

/** Matches a separator on any platform, or a parent-directory segment. */
const UNSAFE_SEGMENT = /[/\\]|^\.\.?$/;

function assertSafeSegment(kind: "scheme" | "version", value: string): void {
  if (value.length === 0 || UNSAFE_SEGMENT.test(value)) {
    throw new TypeError(
      `${kind} "${value}" is not a usable path segment: it must be non-empty and contain no "/", "\\", "." or ".." segment`,
    );
  }
}

function isEnoent(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

/** Wraps a `JSON.parse` failure as a single validation issue at the root. */
function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new InvalidRubricError([{ path: "", message }], `rubric is not valid JSON: ${message}`);
  }
}

export class FileRubricStore implements RubricStore {
  readonly #rootDir: string;

  constructor(rootDir: string) {
    this.#rootDir = rootDir;
  }

  #schemeDir(scheme: string): string {
    assertSafeSegment("scheme", scheme);
    return join(this.#rootDir, scheme);
  }

  #versionPath(scheme: string, version: string): string {
    assertSafeSegment("version", version);
    return join(this.#schemeDir(scheme), `${version}.json`);
  }

  async get(scheme: string, version: string): Promise<Rubric> {
    const path = this.#versionPath(scheme, version);
    let text: string;
    try {
      text = await readFile(path, "utf8");
    } catch (error) {
      if (isEnoent(error)) throw new RubricNotFoundError(scheme, version);
      throw error;
    }
    const rubric = validateWithHash(parseJson(text));
    // The file name is the lookup key, so its content must agree with it.
    // Otherwise `get("s", "2.0")` could hand back a document that says it is
    // version 1.0, and a case would pin a version it never asked for.
    const issues = [];
    if (rubric.scheme !== scheme) {
      issues.push({
        path: "scheme",
        message: `file is under scheme "${scheme}" but declares "${rubric.scheme}"`,
      });
    }
    if (rubric.version !== version) {
      issues.push({
        path: "version",
        message: `file is named "${version}.json" but declares version "${rubric.version}"`,
      });
    }
    if (issues.length > 0) {
      throw new InvalidRubricError(
        issues,
        `rubric at ${path} does not match its location: ${issues.length} issue(s)`,
      );
    }
    return rubric;
  }

  async latestPublished(scheme: string): Promise<Rubric> {
    const dir = this.#schemeDir(scheme);
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch (error) {
      if (isEnoent(error)) throw new RubricNotFoundError(scheme, "latest-published");
      throw error;
    }
    const versions = entries
      .filter((entry) => entry.endsWith(".json"))
      .map((entry) => entry.slice(0, -".json".length));

    const published: Rubric[] = [];
    for (const version of versions) {
      // Read every candidate: a tampered file must raise, not be skipped.
      const rubric = await this.get(scheme, version);
      if (rubric.status === "published") published.push(rubric);
    }
    published.sort((a, b) => compareVersions(a.version, b.version));
    const highest = published.at(-1);
    if (highest === undefined) throw new RubricNotFoundError(scheme, "latest-published");
    return highest;
  }

  async put(rubric: unknown): Promise<Rubric> {
    const parsed = validateWithHash(rubric);
    const path = this.#versionPath(parsed.scheme, parsed.version);
    await mkdir(this.#schemeDir(parsed.scheme), { recursive: true });
    // Write beside the target, then rename: a reader never sees a truncated
    // file and an interrupted write leaves the previous version intact.
    const temp = `${path}.${randomUUID()}.tmp`;
    try {
      await writeFile(temp, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
      await rename(temp, path);
    } catch (error) {
      await rm(temp, { force: true });
      throw error;
    }
    return parsed;
  }
}
