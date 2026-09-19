import { APIPromise, type Questions, type SystemOneResult } from "@typesafe-ai/sdk";
import { vi } from "vitest";
import type { SystemOneClient } from "../types.js";

export const result: SystemOneResult<Questions> = {
  model: "jev-1.13.0",
  answers: { business_in_declared_area: { type: "noul", noul: 0.9 } },
  usage: { input_tokens: 120, output_tokens: 10 },
};

export function fakeClient() {
  const systemOne = vi.fn(
    () => new APIPromise(Promise.resolve(new Response()), async () => result),
  );
  // Vitest erases the SDK method's generic; restore it only at this test boundary.
  return {
    systemOne: systemOne as unknown as SystemOneClient["systemOne"] &
      ReturnType<typeof vi.fn<SystemOneClient["systemOne"]>>,
  };
}
