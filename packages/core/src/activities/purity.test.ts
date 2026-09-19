import { readdirSync, readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const directory = new URL("./", import.meta.url);
const files = readdirSync(directory, { recursive: true }).filter(
  (file): file is string =>
    typeof file === "string" && file.endsWith(".ts") && !file.endsWith(".test.ts"),
);

describe("activity import boundaries", () => {
  it.each(files)("%s respects activity dependencies", (file) => {
    const source = ts.createSourceFile(
      file,
      readFileSync(new URL(file, directory), "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    function check(node: ts.Node) {
      let specifier: ts.Expression | undefined;
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
        specifier = node.moduleSpecifier;
      if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) && node.expression.text === "require"))
      ) {
        specifier = node.arguments[0];
        expect(specifier && ts.isStringLiteralLike(specifier)).toBe(true);
      }
      if (specifier && ts.isStringLiteralLike(specifier)) {
        const name = specifier.text;
        expect(name).not.toMatch(/^@temporalio\/workflow(?:\/|$)/);
        if (/^ajv(?:\/|$)/.test(name)) expect(file).toBe("intake.ts");
        if (/^@typesafe-ai\/sdk(?:\/|$)/.test(name))
          expect(file).toMatch(/^(?:decide\/[^/]+\.ts|factory\.ts|types\.ts)$/);
      }
      ts.forEachChild(node, check);
    }
    check(source);
  });
});
