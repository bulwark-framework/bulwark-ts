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
| 4 | `packages/core/src/` has directories for rubric, resolver, workflows, activities, store, agent, each with an index that exports nothing yet | tree listing |
| 5 | CI runs lint, typecheck, and tests on push | workflow file present and green on first push |
| 6 | Harness check passes | `bash scripts/check-harness.sh` exits 0 |

## Tasks

- [x] Record toolchain decision
- [ ] Workspace root: `package.json` (private, scripts fan out with `pnpm -r`), `pnpm-workspace.yaml`, `.nvmrc`
- [ ] `packages/core/package.json` as `@bulwark-framework/core` with pinned versions for `@typesafe-ai/sdk`, `@temporalio/*`, `zod`, `commander`, `typescript`, lint tool
- [ ] `tsconfig.json` strict
- [ ] Lint and format config
- [ ] `packages/core/src/{rubric,resolver,workflows,activities,store,agent}/` each with an index; layout follows the spec's package shape. `agent/` holds only the `AgentRunner` interface placeholder
- [ ] `packages/core/src/rubric/schema.ts` with the Zod schema and structural rules (no-match label, required paths resolve, threshold keys, routing rules reference known questions, `auto_decline` never default)
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
- Whether Biome and Vitest configs live at the root only or per package. Default: root only until a second package needs different settings.
