import type { Answer, Answers } from "../../resolver/answers.js";
import type { Question, Rubric } from "../../rubric/schema.js";

/**
 * How far the probabilities of one answer may sum away from 1 before the
 * answer is discarded. The SDK rounds probabilities, so exact equality is not
 * expected.
 */
export const MASS_TOLERANCE = 0.01;

function isUnit(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sumsToOne(values: readonly number[]): boolean {
  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.abs(total - 1) <= MASS_TOLERANCE;
}

/**
 * Maps one TypeSafe response onto a Bulwark answer, or returns `undefined`
 * when the response cannot be trusted.
 *
 * An omitted answer is uncertain to the resolver, and uncertainty blocks every
 * automatic route. So anything this function is not sure about is dropped
 * rather than repaired: a wrong primitive, a missing or non-finite value, a
 * confidence or probability outside [0, 1], a label that is not a criterion, a
 * distribution with missing or extra keys, or a distribution whose mass is not
 * about 1. A repaired answer (a `null` read as 0, an empty distribution read
 * as level 0) would let a malformed model response reach `auto_approve`.
 */
export function mapAnswer(question: Question, response: unknown): Answer | undefined {
  if (!isRecord(response) || response.type !== question.type) return undefined;
  switch (question.type) {
    case "noul":
      return isUnit(response.noul) ? { type: "noul", p: response.noul } : undefined;
    case "choice": {
      const { choice, confidence, probabilities } = response;
      if (typeof choice !== "string" || !Object.hasOwn(question.criteria, choice)) return undefined;
      if (!isUnit(confidence) || !isRecord(probabilities)) return undefined;
      const labels = Object.keys(question.criteria);
      const keys = Object.keys(probabilities);
      if (keys.length !== labels.length) return undefined;
      if (!keys.every((key) => Object.hasOwn(question.criteria, key))) return undefined;
      const values = labels.map((label) => probabilities[label]);
      if (!values.every(isUnit) || !sumsToOne(values)) return undefined;
      const distribution: Record<string, number> = {};
      labels.forEach((label, i) => {
        distribution[label] = values[i] as number;
      });
      return { type: "choice", label: choice, confidence, distribution };
    }
    case "score": {
      const { confidence, probabilities } = response;
      if (!isUnit(confidence) || !isRecord(probabilities)) return undefined;
      const levels = question.criteria.length;
      const keys = Object.keys(probabilities);
      if (keys.length !== levels) return undefined;
      if (!keys.every((key) => /^\d+$/.test(key) && Number(key) < levels)) return undefined;
      const distribution = question.criteria.map((_, i) => probabilities[String(i)]);
      if (!distribution.every(isUnit) || !sumsToOne(distribution)) return undefined;
      // The level is the most probable criterion, not the rounded expected
      // score: the resolver compares integer criteria indices. Ties go to the
      // lowest index.
      let level = 0;
      for (let i = 1; i < levels; i += 1) {
        if ((distribution[i] ?? 0) > (distribution[level] ?? 0)) level = i;
      }
      return { type: "score", level, confidence, distribution };
    }
  }
}

/**
 * Maps every trusted response onto the resolver's answer types, keyed by
 * question id. Ids not in the rubric are ignored. Ids with no trusted response
 * are omitted, which the resolver reads as uncertain.
 */
export function mapAnswers(
  questions: Rubric["questions"],
  answers: Readonly<Record<string, unknown>> | null | undefined,
): Answers {
  const mapped: Answers = {};
  if (!isRecord(answers)) return mapped;
  for (const [id, question] of Object.entries(questions)) {
    if (!Object.hasOwn(answers, id)) continue;
    const answer = mapAnswer(question, answers[id]);
    if (!answer) continue;
    // defineProperty keeps a question id such as `__proto__` a plain key.
    Object.defineProperty(mapped, id, {
      value: answer,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return mapped;
}
