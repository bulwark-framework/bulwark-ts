import { describe, expect, it } from "vitest";
import { loadFixture, variant } from "./test-helpers.js";
import { compareVersions, type RubricStore, resolveRef } from "./types.js";

const sign = (n: number): number => Math.sign(n);

describe("compareVersions", () => {
  it("keeps numeric segments beyond 2^53 exact and never returns NaN", () => {
    expect(compareVersions("9007199254740992", "9007199254740993")).toBe(-1);
    expect(compareVersions("9".repeat(400), "8".repeat(400))).toBe(1);
    expect(compareVersions("1.2", "1.2.0")).toBe(-1);
  });

  it("compares numeric segments numerically, not as strings", () => {
    expect(sign(compareVersions("2026.9.10", "2026.9.2"))).toBe(1);
    expect(sign(compareVersions("2026.9.2", "2026.9.10"))).toBe(-1);
  });

  it("orders a higher minor above a lower one", () => {
    expect(sign(compareVersions("2026.10.1", "2026.9.10"))).toBe(1);
  });

  it("treats a shorter version as smaller when shared segments are equal", () => {
    expect(sign(compareVersions("1.0", "1.0.0"))).toBe(-1);
    expect(sign(compareVersions("1.0.0", "1.0"))).toBe(1);
  });

  it("sorts a numeric segment before a non-numeric one", () => {
    expect(sign(compareVersions("1.0.0", "1.0.0-rc"))).toBe(-1);
    expect(sign(compareVersions("1.0.0-rc", "1.0.0"))).toBe(1);
  });

  it("compares two non-numeric segments as strings", () => {
    expect(sign(compareVersions("1.0.0-alpha", "1.0.0-beta"))).toBe(-1);
    expect(sign(compareVersions("1.0.0-beta", "1.0.0-alpha"))).toBe(1);
  });

  it("returns 0 for equal versions", () => {
    expect(compareVersions("2026.9.1", "2026.9.1")).toBe(0);
  });

  it("sorts an array into the expected order", () => {
    const versions = ["2026.10.1", "1.0.0-rc", "2026.9.2", "1.0", "2026.9.10", "1.0.0"];
    expect([...versions].sort(compareVersions)).toEqual([
      "1.0",
      "1.0.0",
      "1.0.0-rc",
      "2026.9.2",
      "2026.9.10",
      "2026.10.1",
    ]);
  });
});

describe("resolveRef", () => {
  const exact = loadFixture();
  const latest = variant(exact, { version: "2026.9.10" });
  const calls: string[] = [];
  const store: RubricStore = {
    get(scheme, version) {
      calls.push(`get:${scheme}:${version}`);
      return Promise.resolve(exact);
    },
    latestPublished(scheme) {
      calls.push(`latest:${scheme}`);
      return Promise.resolve(latest);
    },
    put() {
      throw new Error("not used");
    },
  };

  it("dispatches an exact reference to get", async () => {
    calls.length = 0;
    await expect(
      resolveRef(store, { scheme: "disaster-grant", version: "2026.9.1" }),
    ).resolves.toBe(exact);
    expect(calls).toEqual(["get:disaster-grant:2026.9.1"]);
  });

  it("dispatches a latest-published reference to latestPublished", async () => {
    calls.length = 0;
    await expect(
      resolveRef(store, { scheme: "disaster-grant", latest: "published" }),
    ).resolves.toBe(latest);
    expect(calls).toEqual(["latest:disaster-grant"]);
  });
});
