# 0004 Activities

Status: active, unblocked 2026-09-19 (0003 in review, PR #5). Spec: [0001-runtime-plane.md](../../product-specs/0001-runtime-plane.md) stories 5, 6, 8, 10 to 12, 38 to 40. Third shippable release: the three runtime activities exist, are unit-tested without Temporal, and one live TypeSafe test proves the decide mapping.

## Scope

In: activity factory `createActivities(deps)`; `resolveRubric`, `intake` (contract, validation, passthrough default), `decide` (question mapping, `systemOne` call, answer mapping); `ApplicationFailure` wrapping of the 0002 errors; live TypeSafe test.

Out: any workflow (0005), any LLM intake, retry policies beyond marking non-retryable (the developer's worker owns those).

## Acceptance criteria

| # | Criterion | Proof |
| --- | --- | --- |
| 1 | `createActivities({ store, intake?, typesafe? })` returns `{ resolveRubric, intake, decide }` typed for `proxyActivities` | Typecheck; test that the object keys match the exported `ActivityNames` |
| 2 | `resolveRubric(ref)` resolves `latest-published` to an exact version, verifies the content hash, and returns the rubric with `resolvedVersion` and `contentHash` | Tests: latest resolves; tampered rubric throws `HashMismatchError` as non-retryable `ApplicationFailure` with `type` equal to the error name; unknown ref throws `RubricNotFoundError` non-retryable |
| 3 | `intake({ caseId, facet, artefacts, stateSchema })` validates the returned fragment against `stateSchema.properties[facet]` and throws `IntakeSchemaViolationError` naming the facet and the JSON-schema path on violation | Tests with a valid fragment and one with a wrong type at a nested path |
| 4 | The default intake is a passthrough that returns `artefacts.json` unchanged | Test |
| 5 | `decide({ rubric, state })` builds one `systemOne` request with every question, using `rubric.model_pin`, and returns `{ answers, responseModel, usage }` | Test with a mocked TypeSafe client asserting one call, the model id, and question count |
| 6 | Question mapping: `noul` → Noul with optional `{ true, false }` criteria; `choice` → Choice with label map; `score` → Score with ordered levels | Mapping unit tests per type, shapes checked against the SDK types |
| 7 | Answer mapping produces the 0003 answer types and keys them by question id | Test |
| 8 | `decide` re-verifies the rubric hash before calling TypeSafe | Test: mutated rubric throws `HashMismatchError` and the client is never called |
| 9 | The TypeSafe API key is read from `TYPESAFE_API_KEY` in the worker process; `decide` input has no credential field | Type test on the input type; test that a missing key throws a clear error at factory time, not at first call |
| 10 | Live test against TypeSafe with the disaster-grant fixture, skipped when the key is absent | `pnpm test` skips it locally; with the key set, clear questions land outside `[lo, hi]` and `responseModel` is non-empty |

## Decisions

- Use the TypeSafe agent skill when writing `decide`. Fetch <https://docs.typesafe.ai/sdk/javascript.md> first and record the SDK version and the exact request and response field names in this plan's log.
- Errors from 0002 are wrapped as `ApplicationFailure.nonRetryable(message, error.name, details)`. TypeSafe transport errors are re-thrown unwrapped so the Temporal retry policy applies.
- `stateSchema.properties[facet]` is validated with Ajv in strict mode. The rubric's `state_schema` is JSON Schema, not Zod, because scheme owners author it. Ajv is a `core` dependency; it must never be imported from `workflows/`.
- The factory takes an optional `typesafe` client for tests. In production it constructs one from the environment.

- SDK 0.6.0. Score `level` is the argmax of `probabilities` (ties → lowest index), not `Math.round(score)`, because the resolver requires an integer criteria index and rules compare levels, not expectations. Choice and Score return `confidence` directly; the open question is resolved.
- Argmax uses rubric indices in ascending order. Missing probability keys become zero. Strict comparisons preserve the lowest index on ties.
- The factory checks `TYPESAFE_API_KEY` before creating a default client. Missing or whitespace-only keys fail synchronously. An injected client needs no environment key.
- Intake issues retain dotted facet paths. The error message names the case and facet. Error details remain unchanged after construction.
- Malformed or wrong-primitive responses do not throw during mapping. Unusable shapes become missing answers. Invalid Score distributions produce an invalid level for the resolver.
- Rubric criteria and state allow `unknown` values. SDK JSON type assertions bridge that existing contract without changing the protected rubric schema.
- Recorded after adversarial review (Codex, gpt-6-astra, high, 2026-09-19), five findings, all fixed:
  1. `mapAnswers` repaired malformed Score distributions: a `null` probability read as 0 and an empty distribution read as level 0, so a malformed model response could reach `auto_approve`. The mapper now drops any response it cannot trust: wrong primitive, non-finite or out-of-range values, a label outside the criteria, a distribution with missing or extra keys, or mass not within 0.01 of 1. A dropped answer is uncertain to the resolver, which blocks every automatic route. Regression test resolves the auto-approve fixture with two forged answers and asserts the route is not `auto_approve`.
  2. Choice mapping trusted `confidence` while `probabilities` was missing or NaN. Same fix; Choice now requires the full label set with unit values.
  3. `intake` compiled the extracted facet schema alone, which re-rooted `$ref: "#"` at the facet and broke root `$defs` references. It now adds the whole state schema to Ajv and fetches the validator at `state#/properties/<facet>` with the facet pointer-escaped. Regression tests cover a recursive root reference and a root `$defs` reference.
  4. Ajv compilation errors (unknown format, tuple `items`, unknown keyword) escaped as plain retryable errors. Formats are no longer validated and tuples are accepted; any remaining compilation failure is an `InvalidRubricError` at `state_schema.properties.<facet>`, non-retryable.
  5. The workflow purity guard was a deny-list that let `../activities/index.js` and bare `fs` through. It is now an allow-list (`./*.js`, `../resolver/*.js`, `../rubric/schema.js`, `../rubric/errors.js`, `@temporalio/workflow`; type-only imports exempt) with negative and positive cases over source snippets.
- Accepted, not fixed: the mapper does not check that the Choice `choice` label is the argmax of `probabilities`. The label is the model's selection and the SDK's contract; the resolver's `confidence_below` rule is the policy lever for a weakly held label.

## Tasks

- [x] Read the SDK page; log SDK version and field names here.
- [x] `packages/core/src/activities/types.ts`: inputs, outputs, `ActivityNames`.
- [x] `packages/core/src/activities/failures.ts`: `toApplicationFailure(error)`. Tests.
- [x] `packages/core/src/activities/resolve-rubric.ts`. Tests for criterion 2.
- [x] `packages/core/src/activities/intake.ts`: contract, Ajv validation, passthrough. Tests for criteria 3 and 4.
- [x] `packages/core/src/activities/decide/map-questions.ts`, `map-answers.ts`, `decide.ts`. Tests for criteria 5 to 8.
- [x] `packages/core/src/activities/factory.ts`: `createActivities`. Tests for criteria 1 and 9.
- [x] `packages/core/test/live/typesafe.test.ts`: criterion 10, guarded by `process.env.TYPESAFE_API_KEY`.
- [x] CI: add `TYPESAFE_API_KEY` as an optional secret; the job must stay green without it.
- [x] `ARCHITECTURE.md`: Intake activity and Decide activity rows to implemented. `docs/QUALITY_SCORE.md`.
- [x] Adversarial review before commit.

## Verification log

| Date | Command | Result |
| --- | --- | --- |
| 2026-09-19 | Read TypeSafe skill, installed declarations, and SDK page | SDK 0.6.0. Markdown URL failed through web access. `curl` returned `curl: (6) Could not resolve host: docs.typesafe.ai`. The normal SDK page loaded successfully. |
| 2026-09-19 | SDK contract inspection | Request: `state`, `questions`, `model`. Result: `model`, `answers`, `usage.input_tokens`, `usage.output_tokens`. Noul: `type`, `noul`. Choice: `type`, `choice`, `confidence`, `probabilities`. Score: `type`, `score`, `confidence`, `legend`, `probabilities`. |
| 2026-09-19 | `pnpm --filter @bulwark-framework/core add ajv@8.20.0 --save-exact` | Failed: `ERR_PNPM_UNEXPECTED_STORE`. Existing modules referenced the user store, but pnpm selected a workspace store. |
| 2026-09-19 | Add Ajv offline with the existing store | Failed: `EPERM` while registering the project in the protected user store. |
| 2026-09-19 | Add Ajv offline with a writable store copy | Passed. Copied the existing store to `/private/tmp/bulwark-pnpm-store`, updated generated module metadata, and set `npm_config_store_dir`. Ajv is an exact direct dependency. |
| 2026-09-19 | `pnpm install` | Passed. `Lockfile is up to date, resolution step is skipped`. `Already up to date`. Used the writable store copy. |
| 2026-09-19 | `pnpm format && pnpm lint` (initial and diagnostic repeat) | Failed twice: `Found 5 errors.` / `Found 5 warnings.` / `ELIFECYCLE Command failed with exit code 1.` Fixed import ordering, exhaustive callback return, and non-null assertions. |
| 2026-09-19 | `pnpm format && pnpm lint` (after fixes) | Passed. `Checked 84 files in 17ms. No fixes applied.` |
| 2026-09-19 | `pnpm typecheck` (initial and diagnostic repeat) | Failed twice: TS2345, TS2322, and TS2739 in the test client. Vitest erased the generic SDK signature. The APIPromise parser also needed an async return. Fixed both at the test boundary. Exit status 2. |
| 2026-09-19 | `pnpm format && pnpm lint` (test client fix) | Passed. `Formatted 78 files in 14ms. Fixed 1 file.` / `Checked 84 files in 17ms. No fixes applied.` |
| 2026-09-19 | `pnpm typecheck` (after fixes) | Passed, exit 0. TypeScript emitted no diagnostics. |
| 2026-09-19 | `pnpm test` | Passed. `Test Files 26 passed` and `1 skipped (27)`. `Tests 285 passed` and `1 skipped (286)`. The live suite skipped without credentials. |
| 2026-09-19 | `bash scripts/check-harness.sh` | Passed, exit 0: `harness ok`. |
| 2026-09-19 | `pnpm --filter @bulwark-framework/core build` | Passed, exit 0. `tsc -p tsconfig.build.json` emitted `packages/core/dist/activities/index.js`. |
| 2026-09-19 | `bash scripts/check-harness.sh` (documentation update) | Passed, exit 0: `harness ok`. |
| 2026-09-19 | `pnpm install` (final gates after Score edge-case tests) | Passed, exit 0. `Lockfile is up to date, resolution step is skipped`. `Already up to date`. |
| 2026-09-19 | `pnpm format && pnpm lint` (final) | Passed. `Formatted 78 files in 14ms. Fixed 1 file.` / `Checked 84 files in 17ms. No fixes applied.` |
| 2026-09-19 | `pnpm typecheck` (final) | Passed, exit 0. No diagnostics. |
| 2026-09-19 | `pnpm test` (final) | Passed. `Test Files 26 passed` and `1 skipped (27)`. `Tests 290 passed` and `1 skipped (291)`. |
| 2026-09-19 | `bash scripts/check-harness.sh` (final) | Passed, exit 0: `harness ok`. |
| 2026-09-19 | Orchestrator check of `dist/` | Failed: `decide/test-helpers.js` and `store/test-helpers.js` were emitted, and the former imports `vitest`, a dev dependency. Added `**/test-helpers.ts` to the build exclude list. Rebuild emits neither. |
| 2026-09-19 | Orchestrator rerun after fixes: `pnpm install --frozen-lockfile`, `pnpm format && pnpm lint`, `pnpm typecheck`, `pnpm test`, harness, build | Passed. 290 tests, 1 live test skipped. Live test now runs every facet through `intake` before `decide`. |
| 2026-09-19 | Adversarial review (Codex, gpt-6-astra, high) | 5 findings (3 high, 2 medium), all fixed with regression tests. See Decisions. |
| 2026-09-19 | After review fixes: `pnpm format && pnpm lint && pnpm typecheck && pnpm test`, harness, build | pass, 322 tests, 1 live test skipped |
| 2026-09-19 | `pnpm --filter @bulwark-framework/core build` (final) | Passed, exit 0. `tsc -p tsconfig.build.json`. Verified `packages/core/dist/activities/index.js` exists. |

SDK source: <https://docs.typesafe.ai/sdk/javascript>. Installed contract: `packages/core/node_modules/@typesafe-ai/sdk/dist/index.d.mts`.

## Open questions

- Resolved: SDK 0.6.0 returns `confidence` directly for Choice and Score. No derivation is needed.
