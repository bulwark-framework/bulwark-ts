# 0003 Resolver

Status: active, unblocked 2026-09-19 (0002 complete, PR #4). Spec: [0001-runtime-plane.md](../../product-specs/0001-runtime-plane.md) stories 13 to 20, 42, 43. Second shippable release: a scheme owner can test routing rules against fixture answers with no network.

## Scope

In: answer types mirroring TypeSafe primitives, band helpers, the pure `resolve(answers, rubric)` function, rule-level validation that the 0001 schema cannot express, and the `merge(fragments, staticState)` function the workflow will use.

Out: any I/O, any Temporal import, the decide activity that produces real answers (0004).

## Acceptance criteria

| # | Criterion | Proof |
| --- | --- | --- |
| 1 | `resolve` is pure: same inputs give same output, imports only types and `merge` | Test runs twice and deep-equals; a lint rule or test asserts `resolver/` has no import from `@temporalio/*`, `node:*`, or `@typesafe-ai/sdk` runtime |
| 2 | Each condition type fires: `band` (`no`, `uncertain`, `yes`), `equals`, `is_no_match`, `confidence_below` (explicit and defaulting to `conf_floor`), `score_below`, `score_above` | One test per condition with fixture answers |
| 3 | First match wins; later matching rules do not add reasons | Test with two matching rules asserts one reason |
| 4 | Default route applies when no rule matches, with reason `default` | Test |
| 5 | A Noul probability in `[lo, hi]` is band `uncertain`; exactly `lo` and exactly `hi` are uncertain | Boundary test at `lo`, `hi`, `lo - ε`, `hi + ε` |
| 6 | A Choice selecting the no-match label, or any Choice or Score with confidence below `conf_floor`, is `uncertain` and can never satisfy a rule whose route is `auto_approve` or `auto_decline` | Test: rule `equals: step_2` with confidence 0.4 does not fire; no-match selection with a `default: auto_approve` still routes to `assessor` |
| 7 | A rule referencing an unknown question id, or a condition whose kind does not fit the question type, is rejected by `validateRouting(rubric)` with the rule index and reason | Tests for both cases |
| 8 | `auto_decline` as `routing.default` is rejected | Test |
| 9 | Output is `{ route, reasons: [{ rule_index, question, reason }], uncertain: string[] }` | Type test and snapshot on the disaster-grant fixture |
| 10 | `merge` deep-merges facet fragments then `static_state`; a facet fragment cannot overwrite a `static_state` key | Test |

## Decisions

- A malformed answer is uncertain: `isMalformed` in `bands.ts` defines the checks. The decide activity (0004) should still reject malformed SDK output at the boundary; this is defence in depth.
- Any uncertain question blocks every automatic route, not only rules on that question. A missing answer, or an answer whose primitive does not match its question, counts as uncertain.

- Uncertainty is a hard floor, not a rule: the resolver computes an `uncertain` set first, then evaluates rules. A rule on an uncertain question fires only if its route is `assessor` or `request_info`. Reason: stories 18 to 20 say uncertainty must always reach a person, and relying on rule ordering to guarantee that would be a foot-gun. If no rule handles an uncertain question, the route is `assessor` with reason `uncertain:<question>` regardless of the default.
- Answer shapes are Bulwark's own types (`NoulAnswer { p: number }`, `ChoiceAnswer { label, confidence, distribution }`, `ScoreAnswer { level, confidence, distribution }`) so the resolver never imports the TypeSafe SDK. The decide activity (0004) maps SDK responses into these. Confirm field names against <https://docs.typesafe.ai/sdk/javascript.md> when 0004 starts.
- `validateRouting` lives in `resolver/` and is also called by `rubric/validate` (0002) so a rubric with a broken rule fails at validation, not at first case. `resolve` assumes a validated rubric and does not re-check.

## Tasks

- [x] `packages/core/src/resolver/answers.ts`: answer types, `Answers = Record<questionId, Answer>`.
- [x] `packages/core/src/resolver/bands.ts`: `noulBand(p, thresholds)`, `isUncertain(answer, question, thresholds)`. Tests for criteria 5 and 6.
- [x] `packages/core/src/resolver/validate-routing.ts`: criterion 7 and 8. Wire into `rubric/validate`.
- [x] `packages/core/src/resolver/resolve.ts`: criteria 1 to 4, 9. Tests.
- [x] `packages/core/src/resolver/merge.ts`: criterion 10. Tests.
- [x] `packages/core/fixtures/disaster-grant/answers/*.json`: at least `auto-approve`, `auto-decline`, `uncertain-needs-senior`, `no-match-insurance`, `low-evidence` answer sets. Snapshot tests of `resolve` over each.
- [x] Purity guard test (criterion 1).
- [x] `ARCHITECTURE.md`: Resolver row to implemented. `docs/QUALITY_SCORE.md`: Resolver row.
- [x] Adversarial review before commit (Codex, gpt-6-astra), told to break precedence and uncertainty handling. Four findings, all fixed: malformed answers (probability or confidence outside [0, 1] or NaN, unknown Choice label, non-integer or out-of-range Score level) now count as uncertain; the purity guard is an allow-list and also rejects `require` and dynamic `import(`; `validateRouting` runs the Zod condition schema first so it agrees with `rubricSchema` on NaN and out-of-range numbers; the fixture rubric gained a `needs_senior` band `yes` to `assessor` rule (index 3), the answer sets set `needs_senior` low, and `senior-required.json` was added. Rule indices in the fixture shifted by one from index 3 onward. No findings on first-match precedence or merge.

## Verification log

| Date | Command | Result |
| --- | --- | --- |
| 2026-09-19 | `pnpm format && pnpm lint` | Initial lint failed on import/export ordering in five new files; corrected without lint-disable comments. |
| 2026-09-19 | `pnpm format && pnpm lint` | pass |
| 2026-09-19 | `pnpm typecheck` | pass |
| 2026-09-19 | `pnpm test` | pass: 187 tests in 13 files (after adversarial review fixes) |
| 2026-09-19 | `bash scripts/check-harness.sh` | pass: harness ok |

The schema already rejects every issue checked by `validateRouting`. The integration test therefore verifies that `validate` accepts the fixture and `validateRouting` returns no issues for the parsed result. Runtime imports run from `rubric/validate.ts` through `resolver/validate-routing.ts` to `rubric/schema.ts`; the schema imports only Zod, so this introduces no cycle.

## Open questions

- Should `reasons` include the rules that did not fire, for a determination letter that lists what was checked? Default: no; the outcome record carries the full answers and the rubric version, which is enough to reconstruct.
