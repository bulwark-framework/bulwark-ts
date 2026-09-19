import { expect, it } from "vitest";
import { createEvidenceBudget } from "./evidence-budget.js";
import { EvidenceBudgetExhaustedError } from "./types.js";

it("counts the default budget and preserves it on exhaustion", () => {
  const budget = createEvidenceBudget();
  expect([budget.max, budget.used, budget.remaining]).toEqual([3, 0, 3]);
  for (let i = 0; i < 3; i++) budget.consume();
  expect(() => budget.consume()).toThrow(EvidenceBudgetExhaustedError);
  expect([budget.used, budget.remaining]).toEqual([3, 0]);
});
it("supports zero budget and stable error details", () => {
  expect(() => createEvidenceBudget(0).consume()).toThrow(EvidenceBudgetExhaustedError);
  expect(new EvidenceBudgetExhaustedError({ max: 0 }).toJSON()).toEqual({
    name: "EvidenceBudgetExhaustedError",
    message: "evidence budget exhausted: 0",
    details: { max: 0 },
  });
});
it.each([-1, 0.5, NaN, Infinity])("rejects invalid maximum %s", (max) =>
  expect(() => createEvidenceBudget(max)).toThrow(RangeError),
);
