import { TypeSafeClient } from "@typesafe-ai/sdk";
import { decide } from "./decide/decide.js";
import { wrapBulwarkErrors } from "./failures.js";
import { intake, passthroughIntake } from "./intake.js";
import { resolveRubric } from "./resolve-rubric.js";
import type { Activities, CreateActivitiesOptions } from "./types.js";

export function createActivities(options: CreateActivitiesOptions): Activities {
  let client = options.typesafe;
  if (!client) {
    if (!process.env.TYPESAFE_API_KEY?.trim()) {
      throw new Error(
        "TYPESAFE_API_KEY is not set; the decide activity needs it in the worker process",
      );
    }
    client = new TypeSafeClient();
  }
  const resolve = resolveRubric(options.store);
  const extract = intake(options.intake ?? passthroughIntake);
  const answer = decide(client);
  return {
    resolveRubric: (input) => wrapBulwarkErrors(() => resolve(input)),
    intake: (input) => wrapBulwarkErrors(() => extract(input)),
    decide: (input) => wrapBulwarkErrors(() => answer(input)),
  };
}
