# 0004 Activities

Status: blocked on [0003-resolver.md](0003-resolver.md). Spec: [0001-runtime-plane.md](../../product-specs/0001-runtime-plane.md) stories 5, 6, 8, 10 to 12, 38 to 40. Third shippable release: the three runtime activities exist, are unit-tested without Temporal, and one live TypeSafe test proves the decide mapping.

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

## Tasks

- [ ] Read the SDK page; log SDK version and field names here.
- [ ] `packages/core/src/activities/types.ts`: inputs, outputs, `ActivityNames`.
- [ ] `packages/core/src/activities/failures.ts`: `toApplicationFailure(error)`. Tests.
- [ ] `packages/core/src/activities/resolve-rubric.ts`. Tests for criterion 2.
- [ ] `packages/core/src/activities/intake.ts`: contract, Ajv validation, passthrough. Tests for criteria 3 and 4.
- [ ] `packages/core/src/activities/decide/map-questions.ts`, `map-answers.ts`, `decide.ts`. Tests for criteria 5 to 8.
- [ ] `packages/core/src/activities/factory.ts`: `createActivities`. Tests for criteria 1 and 9.
- [ ] `packages/core/test/live/typesafe.test.ts`: criterion 10, guarded by `process.env.TYPESAFE_API_KEY`.
- [ ] CI: add `TYPESAFE_API_KEY` as an optional secret; the job must stay green without it.
- [ ] `ARCHITECTURE.md`: Intake activity and Decide activity rows to implemented. `docs/QUALITY_SCORE.md`.
- [ ] Adversarial review before commit.

## Verification log

| Date | Command | Result |
| --- | --- | --- |

## Open questions

- Whether TypeSafe returns per-question confidence for Choice and Score in one field or needs deriving from the distribution. Resolve from the SDK page in the first task.
