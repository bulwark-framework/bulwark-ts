import type { Condition, Question, Route, Rubric, Thresholds } from "../rubric/schema.js";
import type { Answer, Answers } from "./answers.js";
import { noulBand, uncertainQuestions } from "./bands.js";

export interface FiredReason {
  rule_index: number;
  question: string;
  reason: string;
}
export interface Resolution {
  route: Route;
  reasons: FiredReason[];
  uncertain: string[];
}

function matches(
  condition: Condition,
  answer: Answer,
  question: Question,
  thresholds: Thresholds,
): boolean {
  if (answer.type !== question.type) return false;
  if ("band" in condition)
    return answer.type === "noul" && noulBand(answer.p, thresholds) === condition.band;
  if ("equals" in condition) return answer.type === "choice" && answer.label === condition.equals;
  if ("is_no_match" in condition)
    return (
      answer.type === "choice" && question.type === "choice" && answer.label === question.no_match
    );
  if ("confidence_below" in condition)
    return (
      answer.type !== "noul" &&
      answer.confidence <
        (condition.confidence_below === true ? thresholds.conf_floor : condition.confidence_below)
    );
  if ("score_below" in condition)
    return answer.type === "score" && answer.level < condition.score_below;
  return answer.type === "score" && answer.level > condition.score_above;
}

export function resolve(answers: Answers, rubric: Rubric): Resolution {
  const uncertain = uncertainQuestions(answers, rubric);
  for (const [rule_index, rule] of rubric.routing.rules.entries()) {
    const id = rule.when.question;
    const answer = Object.hasOwn(answers, id) ? answers[id] : undefined;
    const question = Object.hasOwn(rubric.questions, id) ? rubric.questions[id] : undefined;
    if (!answer || !question || !matches(rule.when, answer, question, rubric.thresholds)) continue;
    if (uncertain.length > 0 && (rule.route === "auto_approve" || rule.route === "auto_decline"))
      continue;
    return {
      route: rule.route,
      reasons: [{ rule_index, question: id, reason: rule.reason }],
      uncertain,
    };
  }
  if (uncertain.length > 0)
    return {
      route: "assessor",
      reasons: uncertain.map((question) => ({
        rule_index: -1,
        question,
        reason: `uncertain:${question}`,
      })),
      uncertain,
    };
  return {
    route: rubric.routing.default,
    reasons: [{ rule_index: -1, question: "", reason: "default" }],
    uncertain: [],
  };
}
