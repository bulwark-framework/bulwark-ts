import type { AssessmentInput } from "../../src/workflows/index.js";
import { bulwarkActivities, reassess, runAssessment } from "../../src/workflows/index.js";
export async function reassessment(input: AssessmentInput, facets: Record<string, unknown>) {
  const activities = bulwarkActivities();
  const previous = await runAssessment(activities, input);
  return reassess(activities, previous, facets);
}
