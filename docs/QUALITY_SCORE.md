# Quality score

Evidence by domain. "unverified" means no check has run. Update when a check runs, with the date.

| Domain | Available checks | Last run | Result | Gaps |
| --- | --- | --- | --- | --- |
| Harness | `bash scripts/check-harness.sh` | 2026-09-19 | pass | Checks paths, AGENTS.md length, local links. Does not check heading anchors or semantic freshness. |
| Typecheck | `pnpm typecheck` | 2026-09-19 | pass (local Node 25.8.1; Node 22 only in CI) | Only `packages/core`; strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` |
| Lint | `pnpm lint` | 2026-09-19 | pass | Biome 2.5 recommended preset plus formatter |
| Unit tests | `pnpm test` | 2026-09-19 | pass, 187 tests in 13 files | Rubric, store, and resolver coverage. No Temporal code or property-based tests yet |
| Rubric schema validation | `pnpm test` (`packages/core/src/rubric/*.test.ts`) | 2026-09-19 | pass | Structural rules, `validate` reporting every issue, canonical-JSON hash with a known vector, and the disaster-grant fixture covering every condition kind |
| Rubric store | `pnpm test` (`packages/core/src/store/*.test.ts`) | 2026-09-19 | pass | Version ordering, latest-published filtering, not-found, and file tamper detection. No concurrency or large-directory tests |
| Resolver | `pnpm test` (`packages/core/src/resolver/*.test.ts`) | 2026-09-19 | pass | six fixture answer sets; malformed answers covered; no property-based tests |
| Eval gate | none | never | unverified | Needs a golden set and TypeSafe credentials |
| Temporal workflows | none | never | unverified | Needs `@temporalio/testing` time-skipping environment |
