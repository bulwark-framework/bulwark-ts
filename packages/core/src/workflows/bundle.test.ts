import { createRequire } from "node:module";
import { bundleWorkflowCode } from "@temporalio/worker";
import { expect, it } from "vitest";

it("bundles the public workflow entry with .js imports resolved to TypeScript", async () => {
  const bundle = await bundleWorkflowCode({
    workflowsPath: createRequire(import.meta.url).resolve("./index.ts"),
  });
  expect(bundle.code.length).toBeGreaterThan(0);
}, 30000);

it("bundles the reference and reassessment workflows", async () => {
  const bundle = await bundleWorkflowCode({
    workflowsPath: createRequire(import.meta.url).resolve("../../test/workflows/index.ts"),
  });
  expect(bundle.code.length).toBeGreaterThan(0);
}, 30000);
