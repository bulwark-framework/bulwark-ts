import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { publishedFixture } from "../../fixtures/disaster-grant/publish-fixture.js";
import { validateWithHash } from "../rubric/validate.js";

it("the published fixture matches the definition and publication overlay exactly", () => {
  const bytes = readFileSync(
    new URL("../../fixtures/disaster-grant/rubric.json", import.meta.url),
    "utf8",
  );
  const artifact = publishedFixture();
  expect(JSON.parse(bytes)).toEqual(artifact);
  expect(bytes).toBe(`${JSON.stringify(artifact, null, 2)}\n`);
  expect(validateWithHash(artifact)).toEqual(artifact);
});
