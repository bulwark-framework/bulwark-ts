import { APIConnectionError } from "@typesafe-ai/sdk";
import { describe, expect, it } from "vitest";
import { loadFixture } from "../../store/test-helpers.js";
import { decide } from "./decide.js";
import { fakeClient, result } from "./test-helpers.js";

describe("decide", () => {
  it("makes exactly one call with pinned model, every question, and state", async () => {
    const client = fakeClient();
    const state = { business: { location_lga: "Lismore" } };
    const output = await decide(client)({ rubric: loadFixture(), state });
    expect(client.systemOne).toHaveBeenCalledTimes(1);
    const request = client.systemOne.mock.calls[0]?.[0];
    if (!request) throw new Error("expected one request");
    expect(request.model).toBe("jev-1.13.0");
    expect(Object.keys(request.questions)).toHaveLength(10);
    expect(request.state).toEqual(state);
    expect(output).toEqual({
      answers: { business_in_declared_area: { type: "noul", p: 0.9 } },
      responseModel: result.model,
      usage: result.usage,
    });
  });
  it("rejects a mutated rubric before calling the client", async () => {
    const client = fakeClient();
    const rubric = loadFixture();
    rubric.thresholds.lo = 0.2;
    await expect(decide(client)({ rubric, state: {} })).rejects.toMatchObject({
      type: "HashMismatchError",
      nonRetryable: true,
    });
    expect(client.systemOne).not.toHaveBeenCalled();
  });
  it("preserves SDK transport errors by identity", async () => {
    const client = fakeClient();
    const error = new APIConnectionError("boom");
    client.systemOne.mockImplementation(() => {
      throw error;
    });
    await expect(decide(client)({ rubric: loadFixture(), state: {} })).rejects.toBe(error);
  });
});
