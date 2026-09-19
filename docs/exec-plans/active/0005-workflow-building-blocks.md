# 0005 Workflow building blocks

Status: blocked on [0004-activities.md](0004-activities.md) (in review, PR #9). Spec: [0001-runtime-plane.md](../../product-specs/0001-runtime-plane.md) stories 1 to 4, 7, 9, 28 to 32, 41, 44. Design: [runtime-plane.md](../../design-docs/runtime-plane.md), "Workflow building blocks". Fourth shippable release: a developer writes their own Temporal workflow, calls `runAssessment` inside it, and runs a case end to end on the automatic routes.

Replaces the earlier plan for a shipped `AssessCase` workflow. Decision recorded 2026-09-19 in [decisions-log.md](../../design-docs/decisions-log.md): the framework ships composable, sandbox-safe functions and a reference example, not a workflow developers must adopt.

## Scope

In: the `workflows` entry point as a set of pure, sandbox-safe functions: `runAssessment`, `reassess`, `createEvidenceBudget`, `buildOutcomeRecord`, `bulwarkActivities`, search-attribute constants and `bulwarkSearchAttributes`; the `testing` entry point with the time-skipping environment and activity mocks; a test-only workflow under `packages/core/test/workflows/` that composes the blocks; worker registration docs.

Out: the human-decision block and the evidence Signal (0006); any workflow shipped for production use; an examples package (follows 0006).

## Acceptance criteria

| # | Criterion | Proof |
| --- | --- | --- |
| 1 | `workflows/index.ts` imports only `resolver`, `rubric/schema`, `rubric/errors`, `@temporalio/workflow`, and types; no `node:*`, no `@typesafe-ai/sdk`, no Ajv, no `activities/` runtime code | The allow-list guard in `workflows/purity.test.ts` (from 0004) and a test that bundles the module with `bundleWorkflowCode` |
| 2 | `bulwarkActivities(options?)` returns `proxyActivities<Activities>` with default timeouts and retry policy; every option is overridable | Test in the test workflow: custom `startToCloseTimeout` reaches the proxy |
| 3 | `runAssessment(activities, input)` with `input = { caseId, rubricRef, artefacts: Record<facet, unknown> }` resolves the rubric once, fans out `intake` with `Promise.all`, merges with `static_state`, calls `decide`, calls `resolve`, and returns `{ pinned: { rubric, version, contentHash }, state, answers, model, usage, resolution }` | Time-skipping test with mocked activities; `resolveRubric` mock is called once; all facets start before any completes (barrier in the mock); decide's input equals the merged state |
| 4 | A facet in `artefacts` that is not a key of `state_schema.properties` fails before any activity runs with `InvalidInputError` naming the facets | Test |
| 5 | `reassess(activities, pinned, previous, facets)` re-runs `intake` only for `facets`, re-merges over `previous.state`, re-decides, re-resolves, and never accepts a rubric reference: its type takes the pinned rubric object | Test: intake mock call count rises by `facets.length`; type test that `reassess` has no `rubricRef` parameter |
| 6 | `createEvidenceBudget(max)` returns `{ remaining, consume() }`; `consume()` past `max` throws `EvidenceBudgetExhaustedError` | Test |
| 7 | `buildOutcomeRecord(result, decidedBy)` returns every field in the spec's outcome list with `workflowId` and `runId` from `workflowInfo()` | Test compares against a literal |
| 8 | `BulwarkSearchAttributes` exports the three keyword attribute names and `bulwarkSearchAttributes(pinned, route)` returns an `upsertSearchAttributes` payload; nothing calls `upsertSearchAttributes` for the developer | Test |
| 9 | `resolution.route` is a discriminated union the developer must branch on; `isAutomatic(resolution)` narrows to `auto_approve` or `auto_decline`. Uncertain answers can never produce `true` | Type test plus the 0003 resolver tests already covering the uncertain floor |
| 10 | Hash mismatch and intake schema violation inside `runAssessment` fail the run with `WorkflowFailedError.cause.type` equal to the error name | Two tests |
| 11 | `@bulwark-framework/core/testing` exports `createTestEnvironment({ activities })` (time-skipping env, worker, client) and `mockActivities({ rubric, answers })` that answers from a fixture answer set | The seam tests use it; README shows a developer using it on their own workflow |
| 12 | The invariants test recipe: a helper `assertAssessmentInvariants(history)` that reads a completed run's history and asserts `resolveRubric` was scheduled once and no `decide` was scheduled with a different rubric hash than the first | Test on the test workflow, positive and a deliberately broken negative workflow |

## Decisions

- No shipped workflow. `runAssessment` is the pipeline; the developer owns the workflow function, its input shape, its id, its queries, and its outcome storage. The workflow id convention `assess-<caseId>-<scheme>@<version>` is documented, not enforced.
- Invariant 3 (pin once) is enforced by types where the sandbox cannot enforce it by control flow: `reassess` and every later block take the pinned rubric object, never a `RubricRef`. Resolving twice requires calling `runAssessment` twice, which is visibly wrong.
- Invariant "uncertainty reaches a person" stays in the resolver (0003). The blocks add `isAutomatic` so the automatic branch is the narrow one and the human branch is the default in a `switch`.
- Search attributes are a convention plus a payload helper. Registering them on a namespace is the developer's job; the helper only formats.
- Activity options are the developer's. `bulwarkActivities` supplies defaults so the quick start is one line.
- The test workflow in `packages/core/test/workflows/reference.ts` is the executable specification of how the blocks compose. It is not exported from the package. The examples package (after 0006) copies it.

## Tasks

- [ ] `packages/core/src/workflows/types.ts`: `AssessmentInput`, `Pinned`, `AssessmentResult`, `OutcomeRecord`, `InvalidInputError`, `EvidenceBudgetExhaustedError`, search attribute names.
- [ ] `packages/core/src/workflows/activities.ts`: `bulwarkActivities`.
- [ ] `packages/core/src/workflows/run-assessment.ts`: `runAssessment`, `reassess`. Criteria 3, 4, 5, 10.
- [ ] `packages/core/src/workflows/evidence-budget.ts`, `outcome.ts`, `search-attributes.ts`, `route.ts` (`isAutomatic`). Criteria 6 to 9.
- [ ] `packages/core/src/workflows/index.ts`. Bundle test. Criterion 1.
- [ ] `packages/core/src/testing/index.ts`: `createTestEnvironment`, `mockActivities`, `assertAssessmentInvariants`. `./testing` export in `package.json`. Criteria 11, 12.
- [ ] `packages/core/test/workflows/reference.ts` and seam tests for criteria 2 to 10.
- [ ] `packages/core/README.md`: "Write your workflow" section built around the reference; worker registration; search attribute registration; test recipe.
- [ ] CI: the Temporal test server download is cached.
- [ ] `ARCHITECTURE.md`: Workflow building blocks row to implemented. `docs/QUALITY_SCORE.md`: Temporal workflows row.
- [ ] Adversarial review before commit; reviewer is asked to break determinism (`Date.now`, `Math.random`, unsorted `Promise.all` results, non-deterministic imports) and to find a composition of the blocks that resolves a rubric twice or reaches an automatic route with an uncertain answer.

## Verification log

| Date | Command | Result |
| --- | --- | --- |

## Open questions

- Whether `bundleWorkflowCode` in a test is too slow for the default `pnpm test`; if so it moves to a `test:bundle` script that CI runs.
- Whether `assertAssessmentInvariants` should also ship as a Vitest matcher. Default: a plain function first.
