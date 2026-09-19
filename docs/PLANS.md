# Plans

How execution plans work in this repository.

## Layout

- `docs/exec-plans/active/`: plans in progress. One file per plan, numbered, for example `0001-scaffold.md`.
- `docs/exec-plans/completed/`: plans whose acceptance criteria all passed. Moved, not copied.
- `docs/exec-plans/tech-debt-tracker.md`: known debt with an owner and an exit criterion.

## A plan contains

1. Scope: what is in and what is out.
2. Acceptance criteria: observable, each with the command or check that proves it.
3. Decisions taken inside the plan, with reasons, or a pointer to [design-docs/decisions-log.md](design-docs/decisions-log.md).
4. Tasks as a checklist. Tick a task in the same commit that completes it.
5. Verification log: command, date, result. Failures stay in the log.
6. Open questions with an owner.

## Lifecycle

Create in `active/`. Update as work happens. When every acceptance criterion has a passing verification entry, move the file to `completed/` and update any index that links it. Do not mark a plan complete because a feature shipped; unchecked tasks stay unchecked.

## Current

Runtime plane, in dependency order. Each plan is a shippable release and a stacked PR layer on the one before it.

- [0001-scaffold.md](exec-plans/completed/0001-scaffold.md): workspace, toolchain, rubric schema. Completed 2026-09-19.
- [0002-rubric-core.md](exec-plans/active/0002-rubric-core.md): hash, validate, typed errors, rubric stores, disaster-grant fixture. Unblocked.
- [0003-resolver.md](exec-plans/active/0003-resolver.md): pure routing engine, band helpers, merge.
- [0004-activities.md](exec-plans/active/0004-activities.md): resolve-rubric, intake, decide activities; live TypeSafe test.
- [0005-workflow-building-blocks.md](exec-plans/active/0005-workflow-building-blocks.md): `runAssessment`, `reassess`, activity proxies, outcome record, search-attribute convention, testing entry with the invariants check. No shipped workflow.
- [0006-human-decision.md](exec-plans/active/0006-human-decision.md): `awaitHumanDecision`, `awaitEvidence`, Signals, SLA, the evidence loop pattern, the examples package. Completes spec 0001.
- [0007-authoring-api.md](exec-plans/active/0007-authoring-api.md): typed `defineRubric` builder and `bulwark rubric build`. Depends on 0003 only; can run beside 0004 to 0006.
