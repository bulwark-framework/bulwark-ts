import type { Band, Condition, Question, Route, RoutingRule } from "../rubric/schema.js";

export interface PendingRule<K extends string = string> {
  route(route: Route, reason: string): RoutingRule & { when: Condition & { question: K } };
}

type ConfidenceAccessor<K extends string> = {
  confidenceBelow(value?: number): PendingRule<K>;
};

export type AccessorFor<Q extends Question, K extends string> = Q extends { type: "noul" }
  ? { band(band: Band): PendingRule<K> }
  : Q extends { type: "choice" }
    ? ConfidenceAccessor<K> & {
        equals(label: keyof Q["criteria"] & string): PendingRule<K>;
        isNoMatch(): PendingRule<K>;
      }
    : Q extends { type: "score" }
      ? ConfidenceAccessor<K> & {
          scoreBelow(level: number): PendingRule<K>;
          scoreAbove(level: number): PendingRule<K>;
        }
      : never;

export type RoutingAccessors<Q extends Record<string, Question>> = {
  [K in keyof Q & string]: AccessorFor<Q[K], K>;
};

function pending(when: Condition): PendingRule {
  // A fresh copy per rule: two rules built from one accessor call must not
  // share a condition object that a later edit could change for both.
  return { route: (route, reason) => ({ when: { ...when }, route, reason }) };
}

export function routingAccessors<Q extends Record<string, Question>>(
  questions: Q,
): RoutingAccessors<Q> {
  const accessors: Record<string, unknown> = Object.create(null);
  for (const id of Object.keys(questions)) {
    const question = questions[id];
    const confidenceBelow = (value?: number) =>
      pending({ question: id, confidence_below: value ?? true });
    switch (question?.type) {
      case "noul":
        accessors[id] = { band: (band: Band) => pending({ question: id, band }) };
        break;
      case "choice":
        accessors[id] = {
          equals: (label: string) => pending({ question: id, equals: label }),
          isNoMatch: () => pending({ question: id, is_no_match: true }),
          confidenceBelow,
        };
        break;
      case "score":
        accessors[id] = {
          confidenceBelow,
          scoreBelow: (level: number) => pending({ question: id, score_below: level }),
          scoreAbove: (level: number) => pending({ question: id, score_above: level }),
        };
        break;
    }
  }
  return accessors as RoutingAccessors<Q>;
}
