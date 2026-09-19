import type { Band, Question, Rubric, Thresholds } from "../rubric/schema.js";
import type { Answer, Answers } from "./answers.js";

export function noulBand(p: number, thresholds: Thresholds): Band {
  if (p < thresholds.lo) return "no";
  if (p > thresholds.hi) return "yes";
  return "uncertain";
}

/** A probability or confidence is usable only when it is a real number in [0, 1]. */
function isUnit(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

/**
 * An answer that cannot be trusted is uncertain: a probability or confidence
 * outside [0, 1] or NaN, a Choice label that is not one of the criteria, or a
 * Score level that is not an integer index into the criteria. Such an answer
 * must never satisfy an automatic route.
 */
export function isMalformed(answer: Answer, question: Question): boolean {
  if (answer.type !== question.type) return true;
  switch (answer.type) {
    case "noul":
      return !isUnit(answer.p);
    case "choice":
      return (
        !isUnit(answer.confidence) ||
        question.type !== "choice" ||
        !Object.hasOwn(question.criteria, answer.label)
      );
    case "score":
      return (
        !isUnit(answer.confidence) ||
        question.type !== "score" ||
        !Number.isInteger(answer.level) ||
        answer.level < 0 ||
        answer.level >= question.criteria.length
      );
  }
}

export function isUncertain(answer: Answer, question: Question, thresholds: Thresholds): boolean {
  if (isMalformed(answer, question)) return true;
  switch (answer.type) {
    case "noul":
      return noulBand(answer.p, thresholds) === "uncertain";
    case "choice":
      return (
        (question.type === "choice" && answer.label === question.no_match) ||
        answer.confidence < thresholds.conf_floor
      );
    case "score":
      return answer.confidence < thresholds.conf_floor;
  }
}

export function uncertainQuestions(answers: Answers, rubric: Rubric): string[] {
  return Object.entries(rubric.questions)
    .filter(([id, question]) => {
      const answer = Object.hasOwn(answers, id) ? answers[id] : undefined;
      // A missing answer, or one of the wrong primitive for its question, must
      // reach a person: neither can satisfy an automatic route safely.
      return answer === undefined || isUncertain(answer, question, rubric.thresholds);
    })
    .map(([id]) => id)
    .sort();
}
