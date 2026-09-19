import { expect, expectTypeOf, it } from "vitest";
import type { Activities } from "../activities/types.js";
import type { Resolution } from "../resolver/resolve.js";
import { isAutomatic } from "./route.js";
import { reassess } from "./run-assessment.js";
import type { AssessmentResult } from "./types.js";

it.each(["auto_approve", "auto_decline", "assessor", "request_info"] as const)(
  "narrows %s",
  (route) => {
    const resolution: Resolution = { route, reasons: [], uncertain: [] };
    expect(isAutomatic(resolution)).toBe(route.startsWith("auto_"));
    if (isAutomatic(resolution))
      expectTypeOf(resolution.route).toEqualTypeOf<"auto_approve" | "auto_decline">();
  },
);
it("rejects automatic routes with uncertainty even on hand-built resolutions", () =>
  expect(isAutomatic({ route: "auto_approve", reasons: [], uncertain: ["q"] })).toBe(false));
it("reassess takes the previous result, no rubric reference, and no separate pin", () => {
  expectTypeOf(reassess).parameters.toEqualTypeOf<
    [Activities, AssessmentResult, Record<string, unknown>]
  >();
});
