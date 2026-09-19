# 0005 Assess workflow

Status: blocked on [0004-activities.md](0004-activities.md). Spec: [0001-runtime-plane.md](../../product-specs/0001-runtime-plane.md) stories 1 to 4, 7, 9, 28 to 32, 41, 44. Fourth shippable release: a developer registers `AssessCase` in their worker and runs a case end to end on the automatic routes.

## Scope

In: `AssessCase` workflow for the automatic paths (`auto_approve`, `auto_decline`), search attributes, status query, outcome record, the time-skipping test recipe with mocked activities, worker registration docs.

Out: the assessor review child workflow, request-info and evidence loops, SLA (all 0006). On the `assessor` or `request_info` route this release completes the workflow with a `pending_human` outcome and no child; 0006 replaces that stub.

## Acceptance criteria

| # | Criterion | Proof |
| --- | --- | --- |
| 1 | `workflows/index.ts` imports only `resolver`, `merge`, and types; no `node:*`, no `@typesafe-ai/sdk`, no Ajv, no `crypto` | Test that bundles the workflows module with `@temporalio/worker`'s `bundleWorkflowCode` and succeeds; static import guard test |
| 2 | Input is `{ caseId, rubricRef, artefacts: Record<facet, unknown>, reviewSla, maxEvidenceLoops?, metadata? }`; facets not present in `state_schema.properties` fail the run with `InvalidInputError` naming them | Test |
| 3 | Resolve happens once: the pinned version and hash appear in the outcome and the query, and a store change mid-run does not alter them | Test: mock `resolveRubric` returns v1, then store is updated; outcome still shows v1 |
| 4 | Intake runs in parallel, one activity per facet | Test: mocked intake records start order; all facets start before any completes (use a barrier in the mock) |
| 5 | State is merged with `static_state` before decide; decide receives the merged state | Test asserts the mocked decide's input |
| 6 | Automatic approve and automatic decline produce an outcome record with every field in the spec's outcome list, `decidedBy: 'system'` | Two tests over the disaster-grant fixture and answer sets from 0003 |
| 7 | Search attributes `BulwarkScheme`, `BulwarkRubricVersion`, `BulwarkRoute` are set after resolve and updated after route | Test reads `workflowInfo().searchAttributes` via query; names exported as constants and documented |
| 8 | Query `status` returns `{ phase, scheme, version, contentHash, route?, answers? }` at each phase | Test queries after intake, after decide |
| 9 | Hash mismatch and intake schema violation fail the run with the typed failure surfaced as `WorkflowFailedError.cause.type` equal to the error name | Two tests |
| 10 | Starting a second workflow with the same `caseId` and a new `rubricRef` is a new instance; documented workflow id convention `assess-<caseId>-<scheme>@<version>` | Test starts two runs; both complete; ids differ |
| 11 | Test recipe: `test/helpers/env.ts` gives a `TestWorkflowEnvironment.createTimeSkipping()` with a worker whose activities are mocks, reusable by developers | README section; the seam tests use it |

## Decisions

- Workflow id is `assess-<caseId>-<scheme>@<resolvedVersion>` so that story 44's upgrade is a new instance by construction. Because the version is only known after resolve, the developer starts the workflow with `assess-<caseId>-<rubricRef>` and the library records the resolved id in search attributes. Recorded as an open question if that proves awkward.
- Search attribute names are prefixed `Bulwark` to avoid collisions in a developer's namespace. The test environment registers them on the fly with `searchAttributes` in the worker options.
- The `pending_human` stub outcome exists only in this plan and is removed in 0006. It is a `BulwarkError` name so tests in 0006 can assert it is gone.
- Activity options (timeouts, retry) are workflow inputs with defaults, not hard-coded, so developers tune them without forking.

## Tasks

- [ ] `packages/core/src/workflows/types.ts`: input, outcome record, status, search attribute constants.
- [ ] `packages/core/src/workflows/assess-case.ts`: resolve, search attributes, intake fan-out, merge, decide, resolve, finalize. Stub on human routes.
- [ ] `packages/core/src/workflows/index.ts` exporting only workflow functions and types. Bundle test for criterion 1.
- [ ] `packages/core/test/helpers/env.ts`, `mocks.ts`: time-skipping environment and activity mocks. Criterion 11.
- [ ] Seam tests for criteria 2 to 10.
- [ ] `packages/core/README.md`: worker registration, search attribute registration, workflow id convention, test recipe.
- [ ] CI: the Temporal test server download is cached.
- [ ] `ARCHITECTURE.md`: Assess workflow row to implemented. `docs/QUALITY_SCORE.md`: Temporal workflows row.
- [ ] Adversarial review before commit; reviewer is asked to break determinism (non-deterministic imports, `Date.now`, `Math.random`, unsorted `Promise.all` results).

## Verification log

| Date | Command | Result |
| --- | --- | --- |

## Open questions

- Whether `bundleWorkflowCode` in a test is too slow for the default `pnpm test`; if so it moves to a `test:bundle` script that CI runs.
- Workflow id convention when the version is unknown at start (see decisions).
