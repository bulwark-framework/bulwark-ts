import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Comments could hide an `import (` split by a comment; remove them before matching.
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, "");
}

const directory = new URL("./", import.meta.url);
const files = readdirSync(directory, { recursive: true }).filter(
  (file): file is string =>
    typeof file === "string" && file.endsWith(".ts") && !file.endsWith(".test.ts"),
);
const ALLOWED = /^(?:\.\/[a-z-]+\.js|\.\.\/(?:rubric|resolver)\/[a-z-]+\.js|zod)$/;

describe("authoring purity", () => {
  it("strips comments so a split import cannot hide", () => {
    expect(stripComments("import /* gap */ (x)")).toMatch(/\bimport\s*\(/);
    expect(stripComments("// import(x)\nconst a = 1;")).not.toMatch(/import/);
  });
  it.each(files)("%s imports only allowed modules", (file) => {
    const source = stripComments(readFileSync(new URL(file, directory), "utf8"));
    const specifiers = [...source.matchAll(/\bfrom\s*["']([^"']+)["']/g)].map((m) => m[1]);
    for (const specifier of specifiers) expect(specifier).toMatch(ALLOWED);
    expect(source).not.toMatch(/\bimport\s*\(/);
    expect(source).not.toMatch(/\bimport\s*["']/);
    expect(source).not.toMatch(/\brequire\s*\(/);
    expect(source).not.toMatch(/\bimport\s*\.\s*meta/);
  });
});
