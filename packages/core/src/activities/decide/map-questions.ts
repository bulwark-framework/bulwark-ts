import type { ChoiceCriteria, NoulQuestion, Questions, ScoreCriteria } from "@typesafe-ai/sdk";
import { InvalidRubricError } from "../../rubric/errors.js";
import type { Rubric } from "../../rubric/schema.js";

export function mapQuestions(questions: Rubric["questions"]): Questions {
  return Object.fromEntries(
    Object.entries(questions).map(([id, question]) => {
      const { type, instructions } = question;
      switch (question.type) {
        case "noul":
          return [
            id,
            {
              type,
              instructions,
              ...(question.criteria
                ? {
                    criteria: question.criteria as NoulQuestion["criteria"],
                  }
                : {}),
            },
          ];
        case "choice":
          return [id, { type, instructions, criteria: question.criteria as ChoiceCriteria }];
        case "score":
          if (question.criteria.length < 2) {
            throw new InvalidRubricError([
              { path: `questions.${id}.criteria`, message: "score requires at least two levels" },
            ]);
          }
          return [
            id,
            { type, instructions, criteria: question.criteria as unknown as ScoreCriteria },
          ];
        default: {
          const unreachable: never = question;
          return unreachable;
        }
      }
    }),
  );
}
