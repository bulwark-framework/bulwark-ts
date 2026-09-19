# 0006 Assessor review and evidence loop

Status: blocked on [0005-assess-workflow.md](0005-assess-workflow.md). Spec: [0001-runtime-plane.md](../../product-specs/0001-runtime-plane.md) stories 21 to 27, 45. Fifth shippable release: the runtime plane is complete. Uncertain cases reach a human, humans decide or request evidence, new evidence re-runs intake for named facets, and unattended cases escalate.

## Scope

In: `AssessorReview` child workflow with Signals, Query, SLA timer, and the proposals slot; the request-info and evidence loop in `AssessCase`; removal of the 0005 stub; move plan 0001 through 0006 to `completed/` when criteria pass.

Out: the bounded researcher itself (the slot accepts proposals, nothing produces them), any UI, notification of assessors (the developer observes the route search attribute).

## Acceptance criteria

| # | Criterion | Proof |
| --- | --- | --- |
| 1 | On route `assessor`, `AssessCase` starts `AssessorReview` as a child with `{ caseId, state, answers, resolution, proposals?: Proposal[] }` and awaits it | Test: child is started with the full resolver output including every probability, score, confidence, and reason |
| 2 | Signal `decision({ identity, outcome, reason })` completes the child; the parent's outcome record has `decidedBy: identity`, the outcome, and the reason | Test |
| 3 | Signal `requestInfo({ identity, facets, note })` returns the child with a `request_info` result; the parent then waits for an `evidence` Signal | Test |
| 4 | Signal `evidence({ facets: Record<facet, artefacts> })` re-runs intake only for the named facets, re-merges, re-decides, re-resolves | Test: mocked intake call count increases by the number of named facets only; decide is called again |
| 5 | The evidence loop is bounded by `maxEvidenceLoops` (default 3); exceeding it routes to `assessor` with reason `evidence_loops_exhausted` | Test with time skipping |
| 6 | Route `request_info` from the resolver (not from a human) also waits for evidence, with the same loop | Test using the `low-evidence` answer set |
| 7 | SLA expiry sets child status `escalated`, updates `BulwarkRoute` to `escalated`, and keeps waiting; a later decision Signal still completes it | Test with time skipping past the SLA |
| 8 | Query `status` on the child returns `{ phase: 'waiting' \| 'escalated', since, proposals }` | Test |
| 9 | The 0005 `pending_human` stub no longer exists | Test asserts the export is gone |
| 10 | The full seam list from the spec's testing section passes in one run | `pnpm test` output attached to the log |

## Decisions

- Signals are defined with `defineSignal` in `workflows/signals.ts` and exported so developers use the same handles from their client code.
- Assessor identity is a plain string on the Signal. Authentication is the developer's client's problem; the library records what it is given.
- On `request_info` the child returns to the parent rather than looping inside the child, so the parent owns intake and the child never touches activities. Keeps the child trivially deterministic.
- Proposals type is `{ id, question: Question, cites: string[], origin: string }`. Accepted proposals never reach the resolver: the child stores acceptances in its status only.

## Tasks

- [ ] `packages/core/src/workflows/signals.ts`: `decisionSignal`, `requestInfoSignal`, `evidenceSignal`, `statusQuery`.
- [ ] `packages/core/src/workflows/assessor-review.ts`: criteria 1, 2, 3, 7, 8.
- [ ] `packages/core/src/workflows/assess-case.ts`: replace the stub with the child call and the evidence loop. Criteria 4, 5, 6, 9.
- [ ] Seam tests for every case in the spec's testing section, including the ones already passing from 0005, run together. Criterion 10.
- [ ] `packages/core/README.md`: Signal usage from a client, SLA and escalation, evidence loop.
- [ ] `ARCHITECTURE.md`: every runtime row to implemented. `docs/QUALITY_SCORE.md`.
- [ ] Move 0001 to 0006 to `docs/exec-plans/completed/`; update [PLANS.md](../../PLANS.md) and [product-specs/index.md](../../product-specs/index.md).
- [ ] Integrated adversarial pass over `git diff main...<top branch>` before merging the stack.

## Verification log

| Date | Command | Result |
| --- | --- | --- |

## Open questions

- Whether escalation should also start a timer for a second, harder escalation. Default: no; one SLA, one escalated state. A developer can observe the search attribute and act.
