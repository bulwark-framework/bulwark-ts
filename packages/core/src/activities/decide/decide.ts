import type { EntryType } from "@typesafe-ai/sdk";
import { validateWithHash } from "../../rubric/validate.js";
import { wrapBulwarkErrors } from "../failures.js";
import type { Activities, SystemOneClient } from "../types.js";
import { mapAnswers } from "./map-answers.js";
import { mapQuestions } from "./map-questions.js";

export function decide(client: SystemOneClient): Activities["decide"] {
  return (input) =>
    wrapBulwarkErrors(async () => {
      const rubric = validateWithHash(input.rubric);
      const result = await client.systemOne({
        state: input.state as EntryType,
        questions: mapQuestions(rubric.questions),
        model: rubric.model_pin,
      });
      return {
        answers: mapAnswers(rubric.questions, result.answers),
        responseModel: result.model,
        usage: result.usage,
      };
    });
}
