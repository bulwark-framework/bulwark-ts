# Assessment graph

Summary of the Assessment Graph design note (private artifact). This is the runtime plane as first designed; [question-set-registry.md](question-set-registry.md) moved research out of it. Read both.

## Node kinds

| Node | Runs on | In | Out | Never does |
| --- | --- | --- | --- | --- |
| Intake | LLM, activity | Raw submitted artefacts for one facet | One JSON fragment conforming to the rubric's state schema, with source spans where possible | Judge eligibility, summarise freely, drop fields |
| Researcher | LLM plus retrieval, activity | State and a scope | Typed questions with citations, plus verbatim policy extracts | Answer its own questions |
| Decision | TypeSafe System One, activity | State plus all questions | One typed answer per question id, response model recorded | See other answers, generate prose, route |
| Resolver | code, workflow-side | Answers, thresholds, hard rules | Route and the reasons that fired | Call a model |

Retry and idempotency: intake keyed on artefact content hash, researcher cached on (scheme version, state hash), decide retried on short backoff.

## Route bands

Nouls: no below `lo`, uncertain from `lo` through `hi` inclusive, yes above `hi`. Starting values 0.30 and 0.70 from the cookbook, to be replaced by values fitted on labelled cases. Choice and Score answers also carry a confidence floor below which the case goes to a human.

Route outcomes: `auto_approve`, `auto_decline`, `assessor`, `senior_assessor`, `request_info`.

## Worked example

Disaster recovery grant for a small business. Ten questions across all three primitives: eligibility gates as Nouls, insurance overlap as a Choice (because the reduction rule branches on which item), evidence quality as a Score (because the guideline describes graded levels). Quantum arithmetic stays in code. A `needs_senior` Noul at 0.46 lands in the uncertain band and alone routes the case to a person.

## Temporal binding

- Workflow is the case. Search attributes: scheme, route, band-crossing flags, assessor id, SLA due.
- Activities are every side effect. Workflow code is deterministic.
- `Promise.all` fan-out over intake activities. One failed facet parks for triage; the others continue.
- Human steps are Signals with timers. The assessor queue is a child workflow awaiting `decision` or `requestInfo`, escalating on SLA expiry.
- `patched()` for prompt and schema changes so old histories replay.

## Risks recorded

Researcher drift (closed by the registry design), Choice candidate coverage (every Choice needs a no-match option), band edges, text-only state (photos enter as captions), typed is not true.
