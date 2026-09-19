# 0006 Human decision and evidence blocks

Status: blocked on [0005-workflow-building-blocks.md](0005-workflow-building-blocks.md). Spec: [0001-runtime-plane.md](../../product-specs/0001-runtime-plane.md) stories 21 to 27, 45. Fifth shippable release: the runtime plane is complete as a library. Uncertain cases reach a human through a block the developer calls, humans decide or request evidence, new evidence re-runs intake for named facets, and unattended cases escalate.

Replaces the earlier plan for an `AssessorReview` child workflow. Same Signals and timer, delivered as functions the developer calls inside their own workflow.

## Scope

In: `awaitHumanDecision`, `awaitEvidence`, the Signal and Query definitions in `workflows/signals.ts`, the escalation timer, the proposals slot; the evidence loop shown in the reference workflow using `reassess` and `createEvidenceBudget` from 0005; the examples package `examples/disaster-grant`; move plans 0001 to 0006 to `completed/` when criteria pass.

Out: the bounded researcher itself (the slot accepts proposals, nothing produces them), any UI, notification of assessors (the developer observes the route search attribute or their own query), a child workflow (a developer who wants isolation wraps the block in their own child).

## Acceptance criteria

| # | Criterion | Proof |
| --- | --- | --- |
| 1 | `awaitHumanDecision({ sla, proposals? , onEscalate? })` registers handlers for `decisionSignal` and `requestInfoSignal`, starts the SLA timer, and resolves to `{ kind: "decision", identity, outcome, reason }` or `{ kind: "request_info", identity, facets, note }` | Time-skipping tests for each Signal |
| 2 | The `decision` result carries the identity string unchanged; `buildOutcomeRecord(result, identity)` from 0005 records it as `decidedBy` | Test |
| 3 | SLA expiry calls `onEscalate()` once, then keeps waiting; a later `decision` Signal still resolves the block | Test with time skipping past the SLA; a test that `onEscalate` calls `upsertSearchAttributes` with `BulwarkRoute: "escalated"` in the reference workflow |
| 4 | `humanDecisionStatus()` returns `{ phase: "waiting" \| "escalated", since, proposals }` for the developer to expose from their own Query | Test |
| 5 | `awaitEvidence()` resolves to `{ facets: Record<facet, unknown> }` from `evidenceSignal` | Test |
| 6 | The reference workflow's evidence loop: on `request_info` (from the resolver or a human) it awaits evidence, calls `reassess` for the named facets only, and routes again; the loop is bounded by `createEvidenceBudget(maxEvidenceLoops)` (default 3) and exhaustion routes to `assessor` with reason `evidence_loops_exhausted` | Tests: intake mock call count rises by the named facets only; `low-evidence` answer set drives the resolver route; exhaustion test |
| 7 | Accepted proposals are stored in the block's status only and never reach `reassess` or `resolve` | Test: a proposal accepted through `acceptProposalSignal` appears in status; the next `decide` input is unchanged |
| 8 | Signals and Queries are exported so client code uses the same handles | README example with `WorkflowClient` sending `decisionSignal` |
| 9 | The 0005 seam list and the spec's testing section pass in one run against the reference workflow | `pnpm test` output attached to the log |
| 10 | `examples/disaster-grant`: a developer-style workflow that composes every block, the file store, the real `decide`, and a Claude Agent SDK intake adapter; runs against the local Temporal dev server and reaches `auto_approve`, `auto_decline`, and `assessor` on the fixture answer sets | Manual run logged; the example's own test uses the `testing` entry with mocked activities |

## Decisions

- The human step is a block, not a child workflow. It sets Signal handlers and a timer inside the caller's workflow and returns a plain result. Reason: a child workflow forces our input contract, our id scheme, and our Query shape on the developer; the block forces none of them. Isolation is one `executeChild` away for developers who want it.
- Signals are defined with `defineSignal` in `workflows/signals.ts` and exported so client code and workflow code share the handles.
- Assessor identity is a plain string on the Signal. Authentication is the developer's client's problem; the library records what it is given.
- Proposals type is `{ id, question: Question, cites: string[], origin: string }`. Accepted proposals never reach the resolver (invariant 5): the block stores acceptances in its status only.
- The evidence loop is a pattern in the reference workflow, not a block, because the developer chooses what happens between evidence and re-assessment. `reassess` and `createEvidenceBudget` make the pattern three lines.

## Tasks

- [ ] `packages/core/src/workflows/signals.ts`: `decisionSignal`, `requestInfoSignal`, `evidenceSignal`, `acceptProposalSignal`, `humanDecisionStatusQuery`.
- [ ] `packages/core/src/workflows/human-decision.ts`: `awaitHumanDecision`, `humanDecisionStatus`. Criteria 1 to 4, 7.
- [ ] `packages/core/src/workflows/evidence.ts`: `awaitEvidence`. Criterion 5.
- [ ] `packages/core/test/workflows/reference.ts`: the human route and the evidence loop. Criterion 6.
- [ ] Seam tests for every case in the spec's testing section, run together. Criterion 9.
- [ ] `examples/disaster-grant`: workspace package, worker, client script, Claude Agent SDK intake adapter, README. Criterion 10.
- [ ] `packages/core/README.md`: Signal usage from a client, SLA and escalation, evidence loop, proposals slot.
- [ ] `ARCHITECTURE.md`: every runtime row to implemented. `docs/QUALITY_SCORE.md`.
- [ ] Move 0001 to 0006 to `docs/exec-plans/completed/`; update [PLANS.md](../../PLANS.md) and [product-specs/index.md](../../product-specs/index.md).
- [ ] Integrated adversarial pass over `git diff main...<top branch>` before merging the stack.

## Verification log

| Date | Command | Result |
| --- | --- | --- |

## Open questions

- Whether escalation should also start a timer for a second, harder escalation. Default: no; one SLA, one `onEscalate`. The developer can chain their own timer.
- Whether the examples package needs the Claude Agent SDK as a workspace dependency or a peer. Default: a direct dependency of the example only; `core` never depends on it.
