# 0005 Workflow building blocks

Status: active, unblocked 2026-09-19 (0004 in review, PR #9). Spec: [0001-runtime-plane.md](../../product-specs/0001-runtime-plane.md) stories 1 to 4, 7, 9, 28 to 32, 41, 44. Design: [runtime-plane.md](../../design-docs/runtime-plane.md), "Workflow building blocks". Fourth shippable release: a developer writes their own Temporal workflow, calls `runAssessment` inside it, and runs a case end to end on the automatic routes.

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
| 5 | `reassess(activities, previous, facets)` re-runs `intake` only for `facets`, re-merges over `previous.state`, re-decides, re-resolves, and never accepts a rubric reference or a separate pin: both come from `previous` | Test: intake mock call count rises by `facets.length`; the pinned object and hash on the second decide equal the first |
| 6 | `createEvidenceBudget(max)` returns `{ remaining, consume() }`; `consume()` past `max` throws `EvidenceBudgetExhaustedError` | Test |
| 7 | `buildOutcomeRecord(result, decidedBy)` returns every field in the spec's outcome list with `workflowId` and `runId` from `workflowInfo()` | Test compares against a literal |
| 8 | `BulwarkSearchAttributes` exports the three keyword attribute names and `bulwarkSearchAttributes(pinned, route)` returns an `upsertSearchAttributes` payload; nothing calls `upsertSearchAttributes` for the developer | Test |
| 9 | `resolution.route` is a discriminated union the developer must branch on; `isAutomatic(resolution)` narrows to `auto_approve` or `auto_decline`. Uncertain answers can never produce `true` | Type test plus the 0003 resolver tests already covering the uncertain floor |
| 10 | Hash mismatch and intake schema violation inside `runAssessment` fail the run with `WorkflowFailedError.cause.type` equal to the error name | Two tests |
| 11 | `@bulwark-framework/core/testing` exports `createTestEnvironment({ activities })` (time-skipping env, worker, client) and `mockActivities({ rubric, answers })` that answers from a fixture answer set | The seam tests use it; README shows a developer using it on their own workflow |
| 12 | The invariants test recipe: a helper `assertAssessmentInvariants(history)` that reads a completed run's history and asserts `resolveRubric` was scheduled once and no `decide` was scheduled with a different rubric hash than the first | Test on the test workflow, positive and a deliberately broken negative workflow |

## Decisions

- No shipped workflow. `runAssessment` is the pipeline; the developer owns the workflow function, its input shape, its id, its queries, and its outcome storage. The workflow id convention `assess-<caseId>-<scheme>@<version>` is documented, not enforced.
- Invariant 3 (pin once) is enforced by types where the sandbox cannot enforce it by control flow: `reassess` and every later block take the previous `AssessmentResult`, which carries the pin, never a `RubricRef` and never a separate pin argument (the adversarial review showed a separate `pinned` parameter let a caller substitute another published rubric). Resolving twice requires calling `runAssessment` twice, which is visibly wrong.
- Invariant "uncertainty reaches a person" stays in the resolver (0003). The blocks add `isAutomatic` so the automatic branch is the narrow one and the human branch is the default in a `switch`.
- Search attributes are a convention plus a payload helper. Registering them on a namespace is the developer's job; the helper only formats.
- Activity options are the developer's. `bulwarkActivities` supplies defaults so the quick start is one line.
- The test workflow in `packages/core/test/workflows/reference.ts` is the executable specification of how the blocks compose. It is not exported from the package. The examples package (after 0006) copies it.

- Search attributes use the array-valued `SearchAttributes` object: workflow SDK 1.24.0 does not re-export the typed constructors. The purity allow-list is unchanged.
- Outcome time is sandbox-patched `Date.now()` formatted as ISO, not workflow start time. The explicit `caseId` argument follows the brief over the abbreviated plan signature.
- Testing and worker dependencies remain development dependencies and are optional exact-version peers. The package's normal workflow entry does not load them.
- Unknown facets are rejected after the necessary rubric-resolution activity and before any intake, as clarified in the brief. Boolean schemas declare no facets.
- `AssessmentResult` carries `caseId`, so `reassess` passes the original case ID to intake without a wrapper, and `buildOutcomeRecord(result, decidedBy)` needs no separate case ID argument. Codex's first cut passed an empty case ID on reassessment; the orchestrator changed this before review. No rubric reference or hidden state was added.
- `createTestEnvironment` registers the three keyword search attributes through `operatorService.addSearchAttributes` before creating the worker. The time-skipping server config accepts no `searchAttributes` option, and an unregistered attribute makes `upsertSearchAttributes` fail the workflow task, which surfaced as nine test timeouts on the first run outside the Codex sandbox.
- The reference wraps resolveRubric to upsert an `assessing` route immediately after pinning, then upserts the final route. It explicitly names proxy methods because a Temporal proxy has no enumerable activity methods.
- The reference sets `failureExceptionTypes: [InvalidInputError]` so validation errors fail the execution rather than retrying workflow tasks. It unwraps ActivityFailure to expose the application failure as WorkflowFailedError.cause, as required by the brief.
- Evidence maxima must be non-negative safe integers. A zero budget is supported. `isAutomatic` also checks uncertainty defensively for hand-built resolutions.
- `intakeDelay` is an async callback receiving IntakeInput, allowing a shared barrier. Test queues default to random UUIDs on the Node side. Worker registration selects and binds only the three activity methods, excluding mock call records.
- The invariants helper follows the brief's “more than once” rule (zero resolve events is permitted), uses the first decide hash as baseline, and rejects missing decide payloads or hashes. Custom codecs must be decoded first.
- The reference reserves maxEvidenceLoops without consuming it: the human/evidence loop belongs to 0006. Its README copy includes identical code and repository-relative imports, with replacement instructions for consumers.
- SDK ephemeral-server.js forwards a null download directory by default; ephemeral-server.d.ts documents the system temporary directory. The cached binary here is `temporal-test-server-sdk-typescript-1.24.0`. Linux CI caches `/tmp/temporal-test-server-*`.
- Both bundle tests remain in the default suite: compilation took 250 ms and 109 ms in the focused run, below the 10-second threshold. The history assertion remains a plain function.

## Tasks

- [x] `packages/core/src/workflows/types.ts`: `AssessmentInput`, `Pinned`, `AssessmentResult`, `OutcomeRecord`, `InvalidInputError`, `EvidenceBudgetExhaustedError`, search attribute names.
- [x] `packages/core/src/workflows/activities.ts`: `bulwarkActivities`.
- [x] `packages/core/src/workflows/run-assessment.ts`: `runAssessment`, `reassess`. Criteria 3, 4, 5, 10.
- [x] `packages/core/src/workflows/evidence-budget.ts`, `outcome.ts`, `search-attributes.ts`, `route.ts` (`isAutomatic`). Criteria 6 to 9.
- [x] `packages/core/src/workflows/index.ts`. Bundle test. Criterion 1.
- [x] `packages/core/src/testing/index.ts`: `createTestEnvironment`, `mockActivities`, `assertAssessmentInvariants`. `./testing` export in `package.json`. Criteria 11, 12.
- [x] `packages/core/test/workflows/reference.ts` and seam tests for criteria 2 to 10.
- [x] `packages/core/README.md`: "Write your workflow" section built around the reference; worker registration; search attribute registration; test recipe.
- [x] CI: the Temporal test server download is cached.
- [x] `ARCHITECTURE.md`: Workflow building blocks row to implemented. `docs/QUALITY_SCORE.md`: Temporal workflows row.
- [x] Adversarial review before commit; reviewer is asked to break determinism (`Date.now`, `Math.random`, unsorted `Promise.all` results, non-deterministic imports) and to find a composition of the blocks that resolves a rubric twice or reaches an automatic route with an uncertain answer.

## Adversarial review (Codex, gpt-6-astra, high, 2026-09-19)

Verdict: needs-attention, three findings, all fixed with regression tests.

1. High. Intake fragments were merged into the root, so `applicant: { role }` became `state.role` and scalar or array facets vanished; the mocks hid it by returning pre-wrapped fragments that real intake would reject. Fix: `extract` nests each fragment under its facet before `merge`. Tests: `run-assessment.test.ts` now runs the real `intake` against the fixture schema and asserts `state.applicant.role`; a scalar/array facet test; the seam test's artefacts are facet-shaped and the merged state is asserted by path.
2. High. `reassess(activities, pinned, previous, facets)` accepted a `pinned` unrelated to `previous.pinned`, so a caller could re-decide under another version without resolving. Fix: signature is `reassess(activities, previous, facets)`; the pin and case id come from `previous`. Docs, README, spec, and design doc updated.
3. Medium. `assertAssessmentInvariants` compared decide hashes only with the first decide, so resolving A and deciding with B passed. Fix: the checker correlates `activityTaskCompleted` with the `resolveRubric` schedule event, decodes `contentHash`, and compares every decide against it. Negative test workflow `decidesOffPin`.

## Verification log

| Date | Command | Result |
| --- | --- | --- |
| 2026-09-19 | `pnpm install` | Failed: `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`. Retried with TTY; registry downloads failed with `ENOTFOUND` and were cancelled. |
| 2026-09-19 | `CI=true pnpm install --offline --store-dir /private/tmp/bulwark-pnpm-store` | Pass: 185 packages reused, 0 downloaded. Used existing writable cache; no dependency version or lockfile change. |
| 2026-09-19 | `pnpm format && pnpm lint` (initial) | Failed: missing closing object brace in outcome.test.ts; fixed. Next lint reported 15 import-order/blank-line errors; applied Biome safe fixes only in the new workflow/testing files. |
| 2026-09-19 | `pnpm typecheck` (initial) | Failed: TS1005, TS1003, TS1138, TS1128 from the same missing brace. Fixed. A later run reported TS7006 on three activity wrapper parameters; contextual typing with `satisfies Activities` fixed them. |
| 2026-09-19 | `pnpm format && pnpm lint` | Pass: 103 files checked, no fixes. |
| 2026-09-19 | `pnpm typecheck` | Pass, exit 0. |
| 2026-09-19 | `pnpm test` | Initial: 354 passed, 9 failed, 1 skipped. All 9 failures are time-skipping startup: `Failed to start ephemeral server: failed to start ephemeral server: Operation not permitted (os error 1): Operation not permitted (os error 1)`. No workflow ran. A second bundle test brings the final suite to 355 passed, 9 blocked failures, 1 skipped. |
| 2026-09-19 | `pnpm test -- --exclude packages/core/test/workflows/blocks.test.ts` | Wrong argument forwarding: still ran the complete suite, 355 passed, 9 blocked failures, 1 skipped. Corrected by removing the extra `--`. |
| 2026-09-19 | `pnpm test --exclude packages/core/test/workflows/blocks.test.ts` | Pass: 355 tests in 33 files; 1 live TypeSafe test skipped in 1 additional file. Both workflow bundles passed, and the unchanged purity guard passed. |
| 2026-09-19 | `bash scripts/check-harness.sh` | Pass: `harness ok`. |
| 2026-09-19 | `pnpm --filter @bulwark-framework/core build` | Pass, exit 0. Both dist/workflows/index.js and dist/testing/index.js emitted; no dist file contains a vitest import. |
| 2026-09-19 | Orchestrator: `pnpm vitest run packages/core/test/workflows/blocks.test.ts` | Initial: 7 of 9 timed out; worker logs showed `search attribute BulwarkRubricVersion is not defined`. After registering attributes in `createTestEnvironment` and the `caseId` change: 9 passed. |
| 2026-09-19 | Orchestrator: `pnpm format && pnpm lint && pnpm typecheck && pnpm test` | Pass: lint clean, typecheck exit 0, 364 passed, 1 skipped (live TypeSafe) in 35 files. |
| 2026-09-19 | Orchestrator: `bash scripts/check-harness.sh`; `pnpm --filter @bulwark-framework/core build` | Pass: `harness ok`; both entry points emitted; `grep vitest dist` empty. |
| 2026-09-19 | Codex adversarial review (gpt-6-astra, high, working tree) | needs-attention: 3 findings (2 high, 1 medium), see section above. |
| 2026-09-19 | Orchestrator, after fixes: `pnpm format && pnpm lint && pnpm typecheck && pnpm test && bash scripts/check-harness.sh && pnpm --filter @bulwark-framework/core build` | Pass: lint clean, typecheck exit 0, 370 passed, 1 skipped in 35 files (10 Temporal seam tests incl. `decidesOffPin`), `harness ok`, dist clean. |

## Open questions

- Resolved: both bundle checks stay in the default test suite.
- Resolved: the invariants helper is a plain function.
- Resolved: all nine Temporal integration tests pass outside the Codex sandbox (orchestrator run, see log).
