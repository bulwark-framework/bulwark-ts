# Quality score

Evidence by domain. "unverified" means no check has run. Update when a check runs, with the date.

| Domain | Available checks | Last run | Result | Gaps |
| --- | --- | --- | --- | --- |
| Harness | `bash scripts/check-harness.sh` | 2026-09-19 | pass | Checks paths, AGENTS.md length, local links. Does not check heading anchors or semantic freshness. |
| Typecheck | `pnpm typecheck` | 2026-09-19 | pass (local Node 25.8.1; Node 22 only in CI) | Only `packages/core`; strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` |
| Lint | `pnpm lint` | 2026-09-19 | pass | Biome 2.5 recommended preset plus formatter |
| Unit tests | `pnpm test` | 2026-09-19 | pass, 322 tests in 26 files. One live test skipped in one additional file | Rubric, store, resolver, activities, authoring, and CLI coverage. No Temporal code or property-based tests yet |
| Rubric schema validation | `pnpm test` (`packages/core/src/rubric/*.test.ts`) | 2026-09-19 | pass | Structural rules, `validate` reporting every issue, canonical-JSON hash with a known vector, and the disaster-grant fixture covering every condition kind |
| Rubric store | `pnpm test` (`packages/core/src/store/*.test.ts`) | 2026-09-19 | pass | Version ordering, latest-published filtering, not-found, and file tamper detection. No concurrency or large-directory tests |
| Resolver | `pnpm test` (`packages/core/src/resolver/*.test.ts`) | 2026-09-19 | pass | six fixture answer sets; malformed answers covered; no property-based tests |
| Authoring API | `pnpm test` (`packages/core/src/authoring/*.test.ts`, `packages/core/src/cli/*.test.ts`) | 2026-09-19 | pass | CLI subprocess paths checked manually, not in the automated suite. `.ts` loading requires compile first. Adversarial review done, 7 findings fixed with regression tests. Node 22 execution pending in CI. |
| Activities | `pnpm test`, `pnpm typecheck`, `pnpm lint`, core build | 2026-09-19 | pass, 103 activity and workflow-guard tests. Full suite: 322 passed, one live test skipped | Adversarial review done, 5 findings fixed with regression tests. Live TypeSafe assertions need `TYPESAFE_API_KEY`. No Temporal worker integration yet. |
| Eval gate | none | never | unverified | Needs a golden set and TypeSafe credentials |
| Temporal workflows | none | never | unverified | Needs `@temporalio/testing` time-skipping environment |
