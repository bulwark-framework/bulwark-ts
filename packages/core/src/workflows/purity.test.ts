import { readdirSync, readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * Workflow code runs in the Temporal sandbox and must stay deterministic. An
 * allow-list of module specifiers is stricter than a deny-list: a relative
 * import of the activities barrel (which pulls in Ajv and the TypeSafe SDK),
 * a bare `fs`, or any package other than `@temporalio/workflow` fails.
 * Type-only imports are exempt because they are erased before bundling.
 */
const ALLOWED = [
  /^\.\/[a-z-]+\.js$/,
  /^\.\.\/resolver\/[a-z-]+\.js$/,
  /^\.\.\/rubric\/(?:schema|errors)\.js$/,
  /^@temporalio\/workflow$/,
];

/** Returns every runtime module specifier in `source` that is not allowed. */
function workflowImportViolations(source: string, fileName = "workflow.ts"): string[] {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const violations: string[] = [];
  const consider = (specifier: string) => {
    if (!ALLOWED.some((pattern) => pattern.test(specifier))) violations.push(specifier);
  };
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node)) {
      const typeOnly = node.importClause?.isTypeOnly === true;
      if (!typeOnly && ts.isStringLiteralLike(node.moduleSpecifier)) {
        consider(node.moduleSpecifier.text);
      }
    } else if (ts.isExportDeclaration(node)) {
      if (
        !node.isTypeOnly &&
        node.moduleSpecifier &&
        ts.isStringLiteralLike(node.moduleSpecifier)
      ) {
        consider(node.moduleSpecifier.text);
      }
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require"))
    ) {
      const argument = node.arguments[0];
      if (argument && ts.isStringLiteralLike(argument)) consider(argument.text);
      else violations.push("<dynamic specifier>");
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return violations;
}

const directory = new URL("./", import.meta.url);
const files = readdirSync(directory, { recursive: true }).filter(
  (file): file is string =>
    typeof file === "string" && file.endsWith(".ts") && !file.endsWith(".test.ts"),
);

describe("workflow import boundaries", () => {
  it.each(files)("%s imports only workflow-safe modules", (file) => {
    const source = readFileSync(new URL(file, directory), "utf8");
    expect(workflowImportViolations(source, file)).toEqual([]);
  });

  it.each([
    'import { createActivities } from "../activities/index.js";',
    'import { Ajv } from "ajv";',
    'import { TypeSafeClient } from "@typesafe-ai/sdk";',
    'import { Context } from "@temporalio/activity";',
    'import { readFileSync } from "fs";',
    'import { readFileSync } from "node:fs";',
    'import { hash } from "../rubric/hash.js";',
    'export * from "../store/index.js";',
    'const m = await import("../activities/index.js");',
    'const m = require("ajv");',
    "const m = await import(name);",
  ])("rejects %s", (source) => {
    expect(workflowImportViolations(source)).not.toEqual([]);
  });

  it.each([
    'import { resolve } from "../resolver/resolve.js";',
    'import { merge } from "../resolver/merge.js";',
    'import type { Rubric } from "../rubric/schema.js";',
    'import type { Activities } from "../activities/types.js";',
    'import { proxyActivities } from "@temporalio/workflow";',
    'export type { AssessInput } from "./types.js";',
  ])("accepts %s", (source) => {
    expect(workflowImportViolations(source)).toEqual([]);
  });
});
