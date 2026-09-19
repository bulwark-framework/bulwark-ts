# Quality score

Evidence by domain. "unverified" means no check has run. Update when a check runs, with the date.

| Domain | Available checks | Last run | Result | Gaps |
| --- | --- | --- | --- | --- |
| Harness | `bash scripts/check-harness.sh` | 2026-09-19 | pass | Checks paths, AGENTS.md length, local links. Does not check heading anchors or semantic freshness. |
| Typecheck | `pnpm typecheck` | 2026-09-19 | pass (local Node 25.8.1; Node 22 only in CI) | Only `packages/core`; strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` |
| Lint | `pnpm lint` | 2026-09-19 | pass | Biome 2.5 recommended preset plus formatter |
| Unit tests | `pnpm test` | 2026-09-19 | pass, 31 tests | Only the rubric schema is covered |
| Rubric schema validation | `pnpm test` (`schema.test.ts`) | 2026-09-19 | pass | Structural rules covered; content hash and the `validate` wrapper arrive in plan 0002 |
| Resolver | none | never | unverified | Needs fixture answers and expected routes |
| Eval gate | none | never | unverified | Needs a golden set and TypeSafe credentials |
| Temporal workflows | none | never | unverified | Needs `@temporalio/testing` time-skipping environment |
