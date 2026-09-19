# 0007 Typed authoring API

Status: active, unblocked 2026-09-19 (0003 in review, PR #5)

Design: [rubric-authorship.md](../../design-docs/rubric-authorship.md).

## Scope

In: `defineRubric` in a new `authoring` entry point; Zod state schema serialised with `z.toJSONSchema`; a typed routing builder keyed by question id; `toArtifact()` that returns a validated rubric with `content_hash` computed; a `bulwark rubric build` CLI subcommand that writes the JSON file; the disaster-grant fixture re-authored through the builder as the reference example, producing `rubric.json` through a documented fixture publication step.

Out: the compile workflow and researchers (questions arrive as a JSON file or an object), approval, the registry, any change to the runtime or the resolver. The artifact schema does not change.

## Acceptance criteria

| # | Criterion | Proof |
| --- | --- | --- |
| 1 | `defineRubric({ scheme, version, state, static, questions, thresholds, routing, default, model_pin })` returns a `RubricDefinition` with `toArtifact(): Rubric` | Typecheck; test that `toArtifact()` output passes `validateWithHash` |
| 2 | `state` accepts a `ZodObject`; the artifact's `state_schema` equals `z.toJSONSchema(state)` and every `required_paths` entry in `questions` resolves against it | Test with the disaster-grant state schema authored in Zod; a question with a bad path fails at `toArtifact()` with `InvalidRubricError` |
| 3 | The routing builder exposes one accessor per question id, typed from `questions`, with only the condition methods valid for that primitive: `band` on Noul; `equals`, `isNoMatch`, `confidenceBelow` on Choice; `confidenceBelow`, `scoreBelow`, `scoreAbove` on Score | Type tests with `expectTypeOf`: `q.needs_senior.equals` is a type error; `q.insurance_overlap.equals("not_a_label")` is a type error |
| 4 | `default` is typed as `Exclude<Route, "auto_decline">` | Type test |
| 5 | The checked-in disaster-grant `rubric.json` equals the definition artifact with published status and the existing provenance overlaid by `publishedFixture()`, then validated and rehashed. The overlay preserves approved_by, approved_at, golden_eval_result, golden_eval_id, corpus_hashes, and origin_of_questions. | Drift test checks deep equality and exact `JSON.stringify(x, null, 2) + "\n"` bytes |
| 6 | `bulwark rubric build <file.js> --out <dir>` writes `<dir>/<scheme>/<version>.json`. Invalid definitions print every issue and exit 1. | Automated core writer, loader, action, and error-format tests. Manual subprocess checks cover the compiled fixture, invalid definition, and missing option. |
| 7 | `authoring` imports nothing from `@temporalio/*` or `@typesafe-ai/sdk` | Import guard test, same pattern as `resolver/purity.test.ts` |
| 8 | `provenance`, `content_hash`, and `status` cannot be set by the author: `defineRubric` sets `status: "draft"`, empty provenance, and computes the hash | Type test that the input type omits them; runtime test that a passed `content_hash` is ignored and recomputed |

## Decisions

- The builder is a thin serialiser. It contains no routing semantics. `validateRouting` from the resolver is the only rule check, so the builder cannot drift from the runtime.
- Questions are a typed object input. The fixture uses a literal with `satisfies Record<string, Question>` to preserve question ids and Choice labels. JSON file loading and `fromCompile` are outside this API.
- `status` is always `draft` from the builder. Approval and publishing are the authoring plane's job.
- Compile first. On local Node 25.8.1, `node --experimental-strip-types` failed with `ERR_MODULE_NOT_FOUND` for `src/authoring/index.js`. Type stripping does not resolve `.js` suffixes to `.ts` sources. The CLI accepts compiled JavaScript. No dependencies were added.
- The CLI lives in `packages/core/src/cli/` using `commander`, which is already a dependency. It is the first CLI command; `compile`, `approve`, and `assess` come later.

- The generated fixture has a formatter-only Biome override. Biome otherwise compacts arrays and breaks the required JSON bytes. Lint remains enabled.
- CLI path components reject separators and parent-directory segments, matching the file store.
- The package build config needs no changes. A separate documented TypeScript invocation compiles the fixture for CLI use.
- Recorded after adversarial review (Codex, gpt-6-astra, 2026-09-19), seven findings, all fixed:
  1. The CLI overwrote an existing `<scheme>/<version>.json` silently. It now opens with `wx` and fails with "already exists"; `--force` allows the overwrite.
  2. The CLI trusted whatever the module's `toArtifact()` returned. It now re-runs `validateWithHash` on a JSON round-trip of the result and rejects any artifact whose status is not `draft`, so a module cannot forge a published rubric. The scheme directory is resolved with `realpath` after `mkdir` and must stay inside `--out`, which blocks a symlinked scheme directory.
  3. `z.toJSONSchema` keeps refinements such as `min(1)` on record keys only as `propertyNames`, which the runtime path walker cannot read. Refinements the walker does not understand are a structural-contract limitation: the artifact carries the shape, not the Zod predicate.
  4. The runtime `pathResolves` does not understand `anyOf`, `oneOf`, `allOf`, `$ref`, `prefixItems`, `propertyNames`, or `not`, so a union or tuple in the state schema would pass at authoring time and fail every `required_paths` check at runtime. `toArtifact()` now rejects a state schema containing any of these keywords with an `InvalidRubricError` at `state_schema...`. Open item for the rubric schema layer: teach `pathResolves` these keywords or document them as unsupported in `rubric-artifact.md`.
  5. `z.toJSONSchema` throws a plain `Error` on `z.date()`, transforms, and other unrepresentable types. It is now caught and re-thrown as `InvalidRubricError` at `state_schema`.
  6. `static_state` and `questions` are snapshotted with a JSON round-trip before hashing. Getters, `Date`, `bigint`, and `undefined` no longer produce an artifact whose hash disagrees with its bytes; non-serialisable values fail with `InvalidRubricError`.
  7. Two routing rules built from one pending accessor shared a single `when` object, so mutating one mutated the other. Each `route()` call now clones the condition. The purity import guards strip comments before matching and reject `import.meta`.

## Tasks

- [x] `packages/core/src/authoring/types.ts`: `RubricDefinitionInput`, `RubricDefinition`, builder types with per-primitive condition methods.
- [x] `packages/core/src/authoring/routing-builder.ts`: plain `q` object over question ids. Type tests for criteria 3 and 4.
- [x] `packages/core/src/authoring/define-rubric.ts`: `defineRubric`, `toArtifact`, Zod serialisation. Tests for criteria 1, 2, 8.
- [x] `packages/core/fixtures/disaster-grant/rubric.definition.ts`: the fixture authored through the builder. Test for criterion 5.
- [x] `packages/core/src/authoring/purity.test.ts`: criterion 7.
- [x] `packages/core/src/cli/index.ts`, `cli/rubric-build.ts`: criterion 6. `bin` entry in `package.json`.
- [x] `packages/core/src/authoring/index.ts`; `./authoring` export in `package.json`.
- [x] `packages/core/README.md`: authoring section with the fixture definition as the example.
- [x] `ARCHITECTURE.md`: new Authoring API row, implemented; CLI row gains `rubric build`. `docs/QUALITY_SCORE.md`.
- [x] Adversarial review before commit; reviewer is told to find a definition that type-checks but produces an artifact `validateWithHash` rejects, and a way for an author to smuggle in `provenance` or `status`.

## Verification log

| Date | Command | Result |
| --- | --- | --- |
| 2026-09-19 | Initial `pnpm typecheck` | Failed: unused type-error directive for `constructor`. Removed the directive and retained the runtime assertion. |
| 2026-09-19 | Initial `pnpm lint` | Failed: exported test helper. Removed the export. |
| 2026-09-19 | Initial `pnpm test` | 206 passed, 1 failed: Biome changed generated fixture bytes. Added a formatter-only override and regenerated through a temporary Vitest file, then removed that file. |
| 2026-09-19 | `pnpm format && pnpm lint` | pass |
| 2026-09-19 | `pnpm typecheck` | pass |
| 2026-09-19 | `pnpm test` | pass, 207 tests in 17 files |
| 2026-09-19 | `bash scripts/check-harness.sh` | pass |
| 2026-09-19 | `pnpm --filter @bulwark-framework/core build` | pass, CLI emitted at `dist/cli/index.js` |
| 2026-09-19 | Manual CLI subprocess checks | Compiled fixture writes a draft. Broken definition exits 1 and prints both issues. Missing `--out` exits 1. |
| 2026-09-19 | Adversarial review (Codex, gpt-6-astra, low) | 7 findings, all fixed with regression tests. See Decisions. |
| 2026-09-19 | After review fixes: `pnpm format && pnpm lint && pnpm typecheck && pnpm test` | pass, 218 tests in 17 files |

Automated CLI tests cover exact output bytes, validation failures, module loading, malformed exports, action dispatch, error formatting, and path traversal.
Commander argument parsing and process exit behavior have manual coverage only.
Node 22 execution remains unverified locally; CI runs it.

## Open questions

- `pathResolves` in `rubric/schema.ts` cannot walk `anyOf`, `oneOf`, `allOf`, `$ref`, `prefixItems`, `propertyNames`, or `not`. The authoring API rejects them. A hand-written JSON artifact that uses them still validates and would fail at runtime. Belongs to the rubric schema layer, not this plan.

- Whether `questions` should also accept a Zod-like inline builder for hand-authored questions in small schemes that never run the compile workflow. Default: no; a plain `Record<string, Question>` literal already type-checks.
- Whether the Python sibling gets an equivalent `define_rubric` with Pydantic. Out of scope here; recorded so the artifact stays the contract between them.
