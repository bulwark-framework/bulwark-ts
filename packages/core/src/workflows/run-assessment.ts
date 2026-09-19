import type { Activities, IntakeInput } from "../activities/types.js";
import { merge } from "../resolver/merge.js";
import { resolve } from "../resolver/resolve.js";
import type { AssessmentInput, AssessmentResult, Pinned } from "./types.js";
import { InvalidInputError } from "./types.js";

/**
 * Runs intake for every facet and returns one root-shaped partial state per
 * facet: `{ [facet]: { [facet]: fragment } }`. Intake validates a fragment
 * against `state_schema.properties[facet]`, so the fragment is the facet's
 * value, not a partial root. Nesting it here is what puts `applicant.role`
 * at `state.applicant.role` for the decide activity and the resolver.
 */
async function extract(
  activities: Activities,
  pinned: Pinned,
  caseId: string,
  facets: Record<string, unknown>,
): Promise<Record<string, Record<string, unknown>>> {
  const properties =
    typeof pinned.rubric.state_schema === "boolean"
      ? {}
      : (pinned.rubric.state_schema.properties ?? {});
  const unknownFacets = Object.keys(facets).filter((facet) => !Object.hasOwn(properties, facet));
  if (unknownFacets.length) throw new InvalidInputError({ unknownFacets });
  const fragments = await Promise.all(
    Object.keys(facets).map(async (facet) => {
      const value = facets[facet];
      const artefacts: IntakeInput["artefacts"] =
        value !== null && typeof value === "object" && "json" in value ? value : { json: value };
      const output = await activities.intake({
        caseId,
        facet,
        artefacts,
        stateSchema: pinned.rubric.state_schema,
      });
      return [facet, { [facet]: output.fragment }] as const;
    }),
  );
  return Object.fromEntries(fragments);
}
async function decide(
  activities: Activities,
  caseId: string,
  pinned: Pinned,
  state: Record<string, unknown>,
): Promise<AssessmentResult> {
  const output = await activities.decide({ rubric: pinned.rubric, state });
  return {
    caseId,
    pinned,
    state,
    answers: output.answers,
    model: output.responseModel,
    usage: output.usage,
    resolution: resolve(output.answers, pinned.rubric),
  };
}
/** Pin once and assess. Per-facet artefacts with a json key pass through; other values are wrapped as { json: value }. */
export async function runAssessment(
  activities: Activities,
  input: AssessmentInput,
): Promise<AssessmentResult> {
  const resolved = await activities.resolveRubric(input.rubricRef);
  const pinned = {
    rubric: resolved.rubric,
    version: resolved.resolvedVersion,
    contentHash: resolved.contentHash,
  };
  const fragments = await extract(activities, pinned, input.caseId, input.artefacts);
  return decide(activities, input.caseId, pinned, merge(fragments, pinned.rubric.static_state));
}
/**
 * Reassess only the supplied facets. The pin and the case id both come from
 * `previous`: there is no rubric reference parameter and no separate pin
 * parameter, so a re-assessment can neither resolve nor substitute a
 * different version (invariant 3). Artefact wrapping matches `runAssessment`.
 * Facets not named keep their value from `previous.state`.
 */
export async function reassess(
  activities: Activities,
  previous: AssessmentResult,
  facets: Record<string, unknown>,
): Promise<AssessmentResult> {
  const { pinned, caseId } = previous;
  const fragments = await extract(activities, pinned, caseId, facets);
  return decide(
    activities,
    caseId,
    pinned,
    merge({ previous: previous.state, ...fragments }, pinned.rubric.static_state),
  );
}
