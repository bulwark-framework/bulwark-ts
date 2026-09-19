import { EvidenceBudgetExhaustedError } from "./types.js";
export interface EvidenceBudget {
  readonly max: number;
  readonly used: number;
  readonly remaining: number;
  consume(): void;
}
export function createEvidenceBudget(max = 3): EvidenceBudget {
  if (!Number.isSafeInteger(max) || max < 0)
    throw new RangeError("max must be a non-negative safe integer");
  let used = 0;
  return {
    max,
    get used() {
      return used;
    },
    get remaining() {
      return max - used;
    },
    consume() {
      if (used === max) throw new EvidenceBudgetExhaustedError({ max });
      used++;
    },
  };
}
