# Quality score

Evidence by domain. "unverified" means no check has run. Update when a check runs, with the date.

| Domain | Available checks | Last run | Result | Gaps |
| --- | --- | --- | --- | --- |
| Harness | `bash scripts/check-harness.sh` | 2026-09-19 | pass | Checks paths, AGENTS.md length, local links. Does not check heading anchors or semantic freshness. |
| Typecheck | none | never | unverified | Scaffold not started |
| Lint | none | never | unverified | Scaffold not started |
| Unit tests | none | never | unverified | Scaffold not started |
| Rubric schema validation | none | never | unverified | Criterion 3 of the scaffold plan |
| Resolver | none | never | unverified | Needs fixture answers and expected routes |
| Eval gate | none | never | unverified | Needs a golden set and TypeSafe credentials |
| Temporal workflows | none | never | unverified | Needs `@temporalio/testing` time-skipping environment |
