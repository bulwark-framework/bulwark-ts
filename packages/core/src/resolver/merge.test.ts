import { expect, it } from "vitest";
import { merge } from "./merge.js";

it("merges facet objects in order and applies static state at every depth", () => {
  expect(
    merge(
      {
        first: { business: { name: "first", nested: { policy: "forged", first: true } } },
        second: { business: { name: "second", nested: { second: true } } },
      },
      { business: { nested: { policy: "fixed" } } },
    ),
  ).toEqual({
    business: { name: "second", nested: { first: true, second: true, policy: "fixed" } },
  });
});
it("replaces arrays and resolves object/scalar conflicts with the later value", () => {
  expect(
    merge(
      {
        a: { list: [1, 2], value: { a: 1 }, other: 1 },
        b: { list: [3], value: 2, other: { a: 1 } },
      },
      { list: [4], other: null },
    ),
  ).toEqual({ list: [4], value: 2, other: null });
});
it("does not mutate inputs or retain mutable plain object/array aliases", () => {
  const fragments = { a: { business: { list: [{ x: 1 }] } } };
  const staticState = { policy: { list: [1] } };
  const before = structuredClone({ fragments, staticState });
  const result = merge(fragments, staticState);
  expect({ fragments, staticState }).toEqual(before);
  expect(result.business).not.toBe(fragments.a.business);
  expect(result.policy).not.toBe(staticState.policy);
  expect((result.business as typeof fragments.a.business).list[0]).not.toBe(
    fragments.a.business.list[0],
  );
});
it("skips prototype-polluting keys including inside arrays and static state", () => {
  const polluted = JSON.parse(
    '{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"nested":{"prototype":1,"safe":2},"list":[{"__proto__":{"polluted":true},"safe":3}]}',
  );
  const result = merge({ a: polluted }, polluted);
  expect(result).toEqual({ nested: { safe: 2 }, list: [{ safe: 3 }] });
  expect(Object.hasOwn(result, "__proto__")).toBe(false);
  expect(Object.hasOwn(result, "constructor")).toBe(false);
  expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
  expect(Object.hasOwn(Object.prototype, "polluted")).toBe(false);
});
it("accepts null-prototype objects and ignores non-object fragments", () => {
  const fragment = Object.assign(Object.create(null), { safe: 1 });
  expect(merge({ a: null, b: [1], c: 3, d: fragment }, {})).toEqual({ safe: 1 });
});
