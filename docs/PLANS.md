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

- [0001-scaffold.md](exec-plans/active/0001-scaffold.md): establish the TypeScript project so code can exist. Blocked on the runtime toolchain decision.
