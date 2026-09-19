export interface NoulAnswer {
  type: "noul";
  /** Probability in [0, 1]. */
  p: number;
}
export interface ChoiceAnswer {
  type: "choice";
  label: string;
  confidence: number;
  distribution: Record<string, number>;
}
export interface ScoreAnswer {
  type: "score";
  /** Index into the question's criteria. */
  level: number;
  confidence: number;
  distribution: number[];
}
export type Answer = NoulAnswer | ChoiceAnswer | ScoreAnswer;
export type Answers = Record<string, Answer>;
