import type { Route, Rubric } from "../rubric/schema.js";
import { CONDITIONS_BY_TYPE, conditionKind, conditionSchema } from "../rubric/schema.js";

export interface RoutingIssue {
  rule_index: number;
  reason: string;
}

export function validateRouting(rubric: Pick<Rubric, "questions" | "routing">): RoutingIssue[] {
  const issues: RoutingIssue[] = [];
  rubric.routing.rules.forEach(({ when }, rule_index) => {
    const question = Object.hasOwn(rubric.questions, when.question)
      ? rubric.questions[when.question]
      : undefined;
    const add = (reason: string) => issues.push({ rule_index, reason });
    // The shape check catches NaN and out-of-range numbers the TypeScript
    // types cannot express, so this function agrees with the Zod schema.
    const shape = conditionSchema.safeParse(when);
    if (!shape.success) {
      add(`condition is malformed: ${shape.error.issues.map((i) => i.message).join("; ")}`);
      return;
    }
    if (!question) {
      add(`unknown question "${when.question}"`);
      return;
    }
    const kind = conditionKind(when);
    if (!CONDITIONS_BY_TYPE[question.type].includes(kind)) {
      add(`condition "${kind}" does not fit a ${question.type} question`);
      return;
    }
    if (
      "equals" in when &&
      question.type === "choice" &&
      !Object.hasOwn(question.criteria, when.equals)
    )
      add(`label "${when.equals}" is not a criterion of "${when.question}"`);
    if (question.type === "score" && ("score_below" in when || "score_above" in when)) {
      const level = "score_below" in when ? when.score_below : when.score_above;
      const max = question.criteria.length - 1;
      if (level < 0 || level > max)
        add(`level ${level} is outside 0..${max} for "${when.question}"`);
    }
  });
  if ((rubric.routing.default as Route) === "auto_decline")
    issues.push({ rule_index: -1, reason: "routing.default must not be auto_decline" });
  return issues;
}
