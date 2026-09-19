import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Criterion 1: the resolver imports only its own modules and the rubric
 * schema. An allow-list is stricter than a deny-list: a bare `fs`, a template
 * or computed dynamic import, a `require`, or a re-export from a module
 * outside this directory all fail.
 */
const directory = new URL("./", import.meta.url);
const files = readdirSync(directory, { recursive: true }).filter(
  (file): file is string =>
    typeof file === "string" && file.endsWith(".ts") && !file.endsWith(".test.ts"),
);
const ALLOWED = /^(?:\.\/[a-z-]+\.js|\.\.\/rubric\/schema\.js)$/;

describe("resolver purity", () => {
  it.each(files)("%s imports only resolver modules and the rubric schema", (file) => {
    const source = readFileSync(new URL(file, directory), "utf8");
    const specifiers = [...source.matchAll(/\bfrom\s*["']([^"']+)["']/g)].map((m) => m[1]);
    for (const specifier of specifiers) expect(specifier).toMatch(ALLOWED);
    expect(source).not.toMatch(/\bimport\s*\(/);
    expect(source).not.toMatch(/\brequire\s*\(/);
  });

  it("the rubric schema the resolver depends on imports only zod", () => {
    const source = readFileSync(new URL("../rubric/schema.ts", import.meta.url), "utf8");
    const specifiers = [...source.matchAll(/\bfrom\s*["']([^"']+)["']/g)].map((m) => m[1]);
    expect(specifiers).toEqual(["zod"]);
  });
});
