# 0001 Scaffold

Status: active, unblocked. Toolchain decided 2026-09-19: Node 22, pnpm, Vitest, Biome. Amended 2026-09-19: pnpm workspace with `packages/core` only, scope `@bulwark-framework` (see [decisions-log.md](../../design-docs/decisions-log.md)).

## Scope

In: pnpm workspace root, the `@bulwark-framework/core` package manifest, TypeScript config, lint and format, test runner, the rubric artifact schema in code, an empty module layout matching [ARCHITECTURE.md](../../../ARCHITECTURE.md), CI for lint, typecheck, and tests.

Out: any Temporal workflow, any TypeSafe call, any LLM call, the registry service, the CLI, and the `activities-claude`, `activities-openai`, `retrieval`, and `intake` packages. Those get their own plans.

## Toolchain

Node 22 pinned in `.nvmrc` and `engines`. pnpm workspace (`pnpm-workspace.yaml`, `packages/*`). Vitest and Biome configured at the root and run across the workspace. See [decisions-log.md](../../design-docs/decisions-log.md).

## Acceptance criteria

| # | Criterion | Proof |
| --- | --- | --- |
| 1 | The workspace installs and `@bulwark-framework/core` typechecks from a clean clone | `pnpm install && pnpm typecheck` exits 0 |
| 2 | Lint and format pass | `pnpm lint` exits 0 |
| 3 | Rubric artifact schema exists in code and validates the example in [rubric-artifact.md](../../design-docs/rubric-artifact.md) | `pnpm test` runs a test that loads the example and passes, and one where a Choice lacking a no-match label fails validation |
| 4 | `packages/core/src/` has directories for rubric, resolver, workflows, activities, store, agent, each with an index; only `rubric` (schema) and `agent` (interface placeholder) export anything | tree listing |
| 5 | CI runs lint, typecheck, and tests on push | workflow file present and green on first push |
| 6 | Harness check passes | `bash scripts/check-harness.sh` exits 0 |

## Decisions

- TypeScript pinned at 5.9.3, not 7.x. TypeScript 7 is the native-port compiler released this year; a scaffold should not be the first adopter. Revisit when Temporal's bundler and Vitest document support.
- Zod 4.6.5. Uses `z.iso.datetime()`, `.loose()`, and `z.record(key, value)`.
- Choice questions gain an optional `no_match` field naming the no-match label, defaulting to `none_of_the_above`. The design doc only said "every Choice must include a no-match label" without saying which; the resolver's `is_no_match` condition needs to know. Added to [rubric-artifact.md](../../design-docs/rubric-artifact.md).
- Required-path resolution: a key missing from a declared `properties` map does not resolve unless `additionalProperties` is explicitly `true` or a schema. Stricter than JSON Schema's default so a typo fails validation. A path may alternatively resolve into `static_state`.
- Zod 4 aborts structural refinements on a type-level failure (wrong type, bad enum such as `routing.default: auto_decline`) but continues after size and format checks (a one-level Score still reaches the routing checks). Acceptable: each fix surfaces the next layer.
- The design-doc example is loaded straight from the markdown in the test, so the doc stays canonical for the example while `schema.ts` is canonical for the shape.

## Tasks

- [x] Record toolchain decision
- [x] Workspace root: `package.json` (private, scripts fan out with `pnpm -r`), `pnpm-workspace.yaml`, `.nvmrc`
- [x] `packages/core/package.json` as `@bulwark-framework/core` with pinned versions for `@typesafe-ai/sdk`, `@temporalio/*`, `zod`, `commander`, `typescript`, lint tool
- [x] `tsconfig.json` strict
- [x] Lint and format config
- [x] `packages/core/src/{rubric,resolver,workflows,activities,store,agent}/` each with an index; layout follows the spec's package shape. `agent/` holds only the `AgentRunner` interface placeholder
- [x] `packages/core/src/rubric/schema.ts` with the Zod schema and structural rules (no-match label, required paths resolve, threshold keys, routing rules reference known questions, `auto_decline` never default; `provenance.corpus_index_ref`, `researcher_model`, `contextualiser_model` optional)
- [x] Tests for criterion 3
- [x] CI workflow
- [x] Update `ARCHITECTURE.md` rows from proposed to implemented for the schema
- [x] Update `QUALITY_SCORE.md` with the first real verification entries

## Verification log

| Date | Command | Result |
| --- | --- | --- |
| 2026-09-19 | `bash scripts/check-harness.sh` | pass, harness only, no code |
| 2026-09-19 | `pnpm install` | exit 0, lockfile generated, all pins resolved exactly (Node 25.8.1 locally; Node 22 exercised only in CI) |
| 2026-09-19 | `pnpm typecheck` | exit 0 |
| 2026-09-19 | `pnpm lint` | exit 0 after `biome migrate --write` (`rules.recommended` → `rules.preset`) and `pnpm format` |
| 2026-09-19 | `pnpm test` | 1 file, 31 tests passed after review fixes: design-doc example validates; Choice without no-match label, unresolved required path, missing threshold keys, unknown rule question, mismatched condition kind, `auto_decline` default all rejected |
| 2026-09-19 | `bash scripts/check-harness.sh` | pass |
| 2026-09-19 | Adversarial review (fresh-context agent) | no blockers; 6 should-fix (prototype keys resolved as paths, loosened hash regex, unbounded score levels, published without provenance, boolean/tuple JSON Schema rejected, `confidence_below: true` undocumented) all fixed with tests; nits on path dot-index ambiguity and union error messages deferred to 0002 |
| 2026-09-19 | CI on first push | pending |

## Open questions

- Whether `src/rubric/` is its own module or lives under `src/registry/`. Resolved: its own module.
- Whether Biome and Vitest configs live at the root only or per package. Resolved: root only.
- `a.0` versus `a[0]`: numeric dot segments are property names, not indices. Decide in 0002 whether to normalise.
- Condition-union failures report `Invalid input` without naming the offending key. Improve in 0002's `validate` wrapper.
