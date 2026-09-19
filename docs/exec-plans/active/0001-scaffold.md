# 0001 Scaffold

Status: active, unblocked. Toolchain decided 2026-09-19: Node 22, pnpm, Vitest, Biome.

## Scope

In: project manifest, TypeScript config, lint and format, test runner, the rubric artifact schema in code, an empty module layout matching [ARCHITECTURE.md](../../../ARCHITECTURE.md), CI for lint, typecheck, and tests.

Out: any Temporal workflow, any TypeSafe call, any LLM call, the registry service, the CLI. Those get their own plans.

## Toolchain

Node 22 pinned in `.nvmrc` and `engines`. pnpm. Vitest. Biome. See [decisions-log.md](../../design-docs/decisions-log.md).

## Acceptance criteria

| # | Criterion | Proof |
| --- | --- | --- |
| 1 | `bulwark-ts` installs and typechecks from a clean clone | `pnpm install && pnpm typecheck` exits 0 |
| 2 | Lint and format pass | `pnpm lint` exits 0 |
| 3 | Rubric artifact schema exists in code and validates the example in [rubric-artifact.md](../../design-docs/rubric-artifact.md) | `pnpm test` runs a test that loads the example and passes, and one where a Choice lacking a no-match label fails validation |
| 4 | Module directories exist for rubric, resolver, workflows, activities, store, each with an index that exports nothing yet | tree listing |
| 5 | CI runs lint, typecheck, and tests on push | workflow file present and green on first push |
| 6 | Harness check passes | `bash scripts/check-harness.sh` exits 0 |

## Tasks

- [x] Record toolchain decision
- [ ] Manifest with pinned versions for `@typesafe-ai/sdk`, `@temporalio/*`, `zod`, `commander`, `typescript`, lint tool
- [ ] `tsconfig.json` strict
- [ ] Lint and format config
- [ ] `src/rubric/`, `src/resolver/`, `src/workflows/`, `src/activities/`, `src/store/` each with an index; layout follows the spec's package shape
- [ ] `src/rubric/schema.ts` with the Zod schema and structural rules (no-match label, required paths resolve, threshold keys, routing rules reference known questions, `auto_decline` never default)
- [ ] Tests for criterion 3
- [ ] CI workflow
- [ ] Update `ARCHITECTURE.md` rows from proposed to implemented for the schema
- [ ] Update `QUALITY_SCORE.md` with the first real verification entries

## Verification log

| Date | Command | Result |
| --- | --- | --- |
| 2026-09-19 | `bash scripts/check-harness.sh` | pass, harness only, no code |

## Open questions

- Whether `src/rubric/` is its own module or lives under `src/registry/`. Default: its own module, since both planes import it.
