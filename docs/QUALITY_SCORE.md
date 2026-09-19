# Quality score

Evidence by domain. "unverified" means no check has run. Update when a check runs, with the date.

| Domain | Available checks | Last run | Result | Gaps |
| --- | --- | --- | --- | --- |
| Harness | `bash scripts/check-harness.sh` | 2026-09-19 | pass | Checks paths, AGENTS.md length, local links. Does not check heading anchors or semantic freshness. |
| Typecheck | `pnpm typecheck` | 2026-09-19 | pass (local Node 25.8.1; Node 22 only in CI) | Only `packages/core`; strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` |
| Lint | `pnpm lint` | 2026-09-19 | pass | Biome 2.5 recommended preset plus formatter |
| Unit tests | `pnpm test` | 2026-09-19 | pass, 370 tests in 35 files. One live TypeSafe test skipped | Rubric, store, resolver, activities, authoring, CLI, workflow blocks, bundle checks, and ten Temporal time-skipping integration tests. No property-based tests yet |
| Rubric schema validation | `pnpm test` (`packages/core/src/rubric/*.test.ts`) | 2026-09-19 | pass | Structural rules, `validate` reporting every issue, canonical-JSON hash with a known vector, and the disaster-grant fixture covering every condition kind |
| Rubric store | `pnpm test` (`packages/core/src/store/*.test.ts`) | 2026-09-19 | pass | Version ordering, latest-published filtering, not-found, and file tamper detection. No concurrency or large-directory tests |
| Resolver | `pnpm test` (`packages/core/src/resolver/*.test.ts`) | 2026-09-19 | pass | six fixture answer sets; malformed answers covered; no property-based tests |
| Authoring API | `pnpm test` (`packages/core/src/authoring/*.test.ts`, `packages/core/src/cli/*.test.ts`) | 2026-09-19 | pass | CLI subprocess paths checked manually, not in the automated suite. `.ts` loading requires compile first. Adversarial review done, 7 findings fixed with regression tests. Node 22 execution pending in CI. |
| Activities | `pnpm test`, `pnpm typecheck`, `pnpm lint`, core build | 2026-09-19 | pass, 103 activity and workflow-guard tests. Full suite: 322 passed, one live test skipped | Adversarial review done, 5 findings fixed with regression tests. Live TypeSafe assertions need `TYPESAFE_API_KEY`. No Temporal worker integration yet. |
| Eval gate | none | never | unverified | Needs a golden set and TypeSafe credentials |
| Temporal workflows | `pnpm test` (10 time-skipping integration tests, 2 bundle checks, purity guard) | 2026-09-19 | pass | Reference workflow in `packages/core/test/workflows/` composes the blocks: pin once, fan-out barrier, unknown facet, hash mismatch, intake violation, reassess, invariants helper positive and two negatives (resolve twice, decide off pin). Adversarial review done, 3 findings fixed with regression tests. |
