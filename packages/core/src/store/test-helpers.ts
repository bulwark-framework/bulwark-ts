/**
 * Helpers shared by the store tests. Not a test file: the Vitest include glob
 * is `*.test.ts`, so this module is never collected as a suite.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { hash, type Rubric, validate } from "../rubric/index.js";

const here = dirname(fileURLToPath(import.meta.url));

/** The canonical published rubric: `disaster-grant` version `2026.9.1`. */
export function loadFixture(): Rubric {
  const path = resolve(here, "../../fixtures/disaster-grant/rubric.json");
  return validate(JSON.parse(readFileSync(path, "utf8")));
}

/** Placeholder hash used while the real one is being computed. */
const PLACEHOLDER = `sha256:${"0".repeat(64)}`;

export interface RubricOverrides {
  version?: string;
  status?: Rubric["status"];
  provenance?: Record<string, unknown>;
}

/**
 * Returns a copy of `base` with `overrides` applied and a freshly computed
 * `content_hash`, so the result passes `validateWithHash`. `provenance` keys
 * are merged into the base provenance rather than replacing it.
 */
export function variant(base: Rubric, overrides: RubricOverrides = {}): Rubric {
  const merged: Record<string, unknown> = {
    ...(structuredClone(base) as unknown as Record<string, unknown>),
    ...(overrides.version === undefined ? {} : { version: overrides.version }),
    ...(overrides.status === undefined ? {} : { status: overrides.status }),
    provenance: { ...base.provenance, ...(overrides.provenance ?? {}) },
    content_hash: PLACEHOLDER,
  };
  const parsed = validate(merged);
  return { ...parsed, content_hash: hash(parsed as unknown as Record<string, unknown>) };
}
