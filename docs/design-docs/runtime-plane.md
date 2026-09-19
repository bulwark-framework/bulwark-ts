# Runtime plane

Status: accepted. Layers 0002 to 0004 are implemented and in review. Layers 0005 and 0006 are planned. Revised 2026-09-19: the top two layers ship workflow building blocks the developer composes in their own workflow, not an `AssessCase` workflow they register. This document is the single map of the runtime plane. The exec plans hold the acceptance criteria. The product spec holds the user stories. Link here rather than restating.

Spec: [0001-runtime-plane.md](../product-specs/0001-runtime-plane.md). Plans: [0002](../exec-plans/active/0002-rubric-core.md), [0003](../exec-plans/active/0003-resolver.md), [0004](../exec-plans/active/0004-activities.md), [0005](../exec-plans/active/0005-workflow-building-blocks.md), [0006](../exec-plans/active/0006-human-decision.md). Background: [assessment-graph.md](assessment-graph.md), [rubric-artifact.md](rubric-artifact.md).

## What the runtime plane is

The runtime plane is one npm package, `@bulwark-framework/core`, that a developer uses from their own Temporal workflow and worker. It gives them activities and sandbox-safe workflow functions. Composed, they take a case, pin one rubric version, extract the submitted material into a state document, ask every question in one TypeSafe System One call, and route the case with plain code. Uncertain cases go to a human through a block that waits on Signals inside the developer's workflow. Every input, answer, threshold, and route lands in Temporal event history under the pinned `scheme@version`.

Bulwark is a framework, not an application. It does not ship a workflow the developer must register. The developer owns the workflow function, its input shape, its id, its Queries, and where the outcome is stored. Bulwark owns the pieces that carry the invariants: the rubric contract, the resolver, the activities, and the blocks that sequence them.

Five things never change:

1. Only code decides. A model returns probabilities, labels, levels, and confidences. The resolver turns them into a route.
2. A case resolves one rubric version once and never re-fetches it.
3. Every model call and every I/O is a Temporal activity. Workflow code stays deterministic.
4. Uncertainty always reaches a person. No rule ordering can bypass this.
5. Errors are typed. Retry policy and triage differ by cause.

## Layers

![Runtime plane layers: five stacked boxes, one per exec plan, from rubric core at the bottom to the human decision block at the top](docs/diagrams/runtime-plane-layers.svg)

Source: [runtime-plane-layers.svg](../diagrams/runtime-plane-layers.svg).

Each exec plan is one layer. A layer imports only from the layers below it. The order is also the order the PR stack merges in. The two top layers export functions, not a workflow: nothing in `core` is registered with a worker except the activities.

| Layer | Plan | Modules | Owns | Status |
| --- | --- | --- | --- | --- |
| Rubric core and stores | 0002 | `rubric/schema.ts`, `validate.ts`, `hash.ts`, `errors.ts`, `store/types.ts`, `memory.ts`, `file.ts` | The rubric contract, its identity (content hash), its storage, and the error hierarchy every later layer throws | in review, [PR #4](https://github.com/bulwark-framework/bulwark-ts/pull/4) |
| Resolver | 0003 | `resolver/answers.ts`, `bands.ts`, `resolve.ts`, `validate-routing.ts`, `merge.ts` | Turning answers into a route. Merging facet state. Pure code with no I/O | in review, [PR #5](https://github.com/bulwark-framework/bulwark-ts/pull/5) |
| Activities | 0004 | `activities/factory.ts`, `resolve-rubric.ts`, `intake.ts`, `decide/`, `failures.ts` | Every side effect: store reads, intake extraction, the TypeSafe call. Error wrapping for Temporal | in review, [PR #9](https://github.com/bulwark-framework/bulwark-ts/pull/9) |
| Workflow building blocks | 0005 | `workflows/run-assessment.ts`, `activities.ts`, `evidence-budget.ts`, `outcome.ts`, `search-attributes.ts`, `testing/` | The deterministic case pipeline as functions the developer calls from their workflow. Activity proxies with defaults. Outcome record. Search-attribute convention. Test recipe and invariants check | planned |
| Human decision and evidence blocks | 0006 | `workflows/human-decision.ts`, `evidence.ts`, `signals.ts`, `examples/disaster-grant` | The human gate as a block. Signals, SLA, escalation, proposals slot. The evidence loop as a documented pattern. The reference example | planned |

### Rubric core and stores (0002)

The rubric is a JSON artifact. The Zod schema in `schema.ts` is its canonical definition. Validation reports every issue, not the first. The structural rules that Zod cannot express as types live in a `superRefine`: every Choice names a no-match label that exists, every required path resolves in the state schema or static state, every routing rule fits its question, and the default route is never `auto_decline`.

The content hash is SHA-256 over canonical JSON. Canonical means sorted keys and no whitespace. Four fields are removed first: `status`, `provenance.approved_by`, `provenance.approved_at`, and `content_hash` itself. So approving a rubric does not change its identity. The hash is computed over the parsed rubric, after schema defaults. Two authors who write the defaults differently get the same hash. The Python sibling must apply the same defaults.

Stores implement `get(scheme, version)`, `latestPublished(scheme)`, and `put(rubric)`. Versions order segment-wise on dot-separated integers, with BigInt precision. The memory store verifies the hash once on `put` and isolates stored documents from caller mutation. The file store verifies the hash on every read, rejects a file whose declared scheme or version disagrees with its path, and writes through a temp file and rename.

Errors extend `BulwarkError`. Each class has a stable `name` that survives JSON: `InvalidRubricError`, `RubricNotFoundError`, `HashMismatchError`, `IntakeSchemaViolationError`. Temporal wrapping happens in 0004, not here, so the classes work outside a worker.

### Resolver (0003)

![How the resolver routes a case: compute the uncertain set, walk rules in order skipping automatic routes when anything is uncertain, then fall back to assessor or the default](docs/diagrams/resolver-uncertainty.svg)

Source: [resolver-uncertainty.svg](../diagrams/resolver-uncertainty.svg).

Answers are Bulwark's own types, not SDK types: `NoulAnswer { p }`, `ChoiceAnswer { label, confidence, distribution }`, `ScoreAnswer { level, confidence, distribution }`. The decide activity maps SDK output into them. The resolver never imports the SDK, Temporal, or `node:*`. A test enforces this with an allow-list over import specifiers.

Routing has three steps.

1. **Compute the uncertain set.** A question is uncertain when its answer is missing, is the wrong primitive, is malformed, is a Noul with `lo <= p <= hi`, is a Choice that selected the no-match label, or is a Choice or Score with confidence below `conf_floor`. Malformed means a probability or confidence outside `[0, 1]` or NaN, a label not in the criteria, or a level that is not an integer index into the criteria.
2. **Walk the rules in order.** The first rule whose condition holds wins and contributes one reason. If the uncertain set is not empty, rules whose route is `auto_approve` or `auto_decline` are skipped entirely. Uncertainty anywhere blocks every automatic route, not only rules on the uncertain question.
3. **Fall back.** If no rule fired and the set is not empty, the route is `assessor` with one `uncertain:<question>` reason per question. If the set is empty, the route is `routing.default` with reason `default`.

`merge(fragments, staticState)` deep-merges the facet fragments and applies `static_state` last, so a facet cannot overwrite policy text. Arrays replace. Prototype keys are skipped.

`validateRouting` is the pure rule check. It runs the Zod condition schema first so it agrees with `rubricSchema` on NaN and out-of-range numbers. The rubric `validate` function calls it after a successful parse.

### Activities (0004)

Activities are the only place the runtime plane touches the world. `createActivities({ store, intake?, typesafe? })` returns three functions typed for `proxyActivities`.

- `resolveRubric(ref)` resolves `latest-published` to an exact version, verifies the hash, and returns the rubric with the resolved version and hash.
- `intake({ caseId, facet, artefacts, stateSchema })` extracts one facet into a fragment and validates it with Ajv against `state_schema.properties[facet]`. The default is a passthrough that returns `artefacts.json`. Ajv never enters `workflows/`.
- `decide({ rubric, state })` re-verifies the hash, builds one `systemOne` request with every question at `model_pin`, and maps the response into resolver answers. The API key comes from `TYPESAFE_API_KEY` in the worker process. It never appears in workflow input or history.

0002 errors become `ApplicationFailure.nonRetryable(message, error.name, details)`. TypeSafe transport errors are re-thrown unwrapped so the retry policy applies.

### Workflow building blocks (0005)

![One case through the runtime plane: resolve rubric, intake fan-out, merge, decide, resolve, then the three route families with the human decision block and the evidence loop](docs/diagrams/runtime-plane-case-flow.svg)

Source: [runtime-plane-case-flow.svg](../diagrams/runtime-plane-case-flow.svg). The diagram is the pipeline `runAssessment` runs and the branches the developer's workflow takes on its result.

The developer writes the workflow. Bulwark gives them the pipeline as one call and the pieces around it as small functions, all importable inside the Temporal sandbox.

| Block | Does | Carries |
| --- | --- | --- |
| `bulwarkActivities(options?)` | `proxyActivities<Activities>` with default timeouts and retry policy | Invariant 6 by construction: every side effect is behind a proxy |
| `runAssessment(activities, { caseId, rubricRef, artefacts })` | Resolve once. Fan out intake with `Promise.all`. Merge with `static_state`. Decide. Resolve. Returns the pinned rubric, state, answers, model, usage, and resolution | Invariant 3: the rubric reference is consumed here and nowhere else |
| `reassess(activities, previous, facets)` | Re-run intake for the named facets only, re-merge over the previous state, re-decide, re-resolve | Invariant 3 by type: the pin and case id come from the previous result; there is no reference and no separate pin parameter |
| `isAutomatic(resolution)` | Narrows to `auto_approve` or `auto_decline` | Uncertainty reaches a person: the resolver never returns an automatic route with an uncertain answer, so the human branch is the default arm of the developer's `switch` |
| `createEvidenceBudget(max)` | A counter whose `consume()` throws past `max` | The evidence loop stays bounded |
| `buildOutcomeRecord(result, decidedBy)` | The audit record from the spec, with workflow and run ids | One record per determination |
| `BulwarkSearchAttributes`, `bulwarkSearchAttributes(pinned, route)` | The three keyword attribute names and an `upsertSearchAttributes` payload | A convention, so dashboards across adopters can agree on it |

A reference workflow that composes the blocks lives in `packages/core/test/workflows/reference.ts`. It is the executable specification and the source the examples package copies. It is not exported: shipping it would make it the thing developers adopt, and the point is that they do not have to.

The workflow id convention `assess-<caseId>-<scheme>@<version>` is documented so that upgrading a case to a newer rubric is a new instance. It is the developer's to apply.

`workflows/index.ts` imports only the resolver, the rubric schema and errors, `@temporalio/workflow`, and types. The allow-list guard from 0004 and a `bundleWorkflowCode` test prove it fits the sandbox.

The `testing` entry point gives developers a time-skipping environment with mocked activities that answer from a fixture answer set, and `assertAssessmentInvariants(history)`, which reads a completed run's history and fails if `resolveRubric` was scheduled more than once or `decide` was scheduled with a rubric hash other than the pinned one. That check is how the two invariants that live in control flow are verified against a developer's own workflow.

### Human decision and evidence blocks (0006)

On route `assessor`, the developer's workflow calls `awaitHumanDecision({ sla, proposals?, onEscalate? })`. The block registers handlers for two Signals and starts the SLA timer, then resolves to one of two results. `decision({ identity, outcome, reason })` gives `{ kind: "decision", ... }`. `requestInfo({ identity, facets, note })` gives `{ kind: "request_info", ... }`. When the SLA expires the block calls `onEscalate()` once and keeps waiting; the reference workflow uses that hook to set `BulwarkRoute` to `escalated`. `humanDecisionStatus()` returns phase, since, and proposals for the developer to expose from their own Query.

On `request_info`, whether from the resolver or from a human, the developer's workflow calls `awaitEvidence()`, which resolves on the `evidence({ facets })` Signal, then `reassess` for the named facets only and routes again. The reference workflow bounds this with `createEvidenceBudget(maxEvidenceLoops)`, default 3, and routes to `assessor` with reason `evidence_loops_exhausted` when the budget is spent.

The block has a proposals slot for the bounded researcher. Nothing produces proposals in this plane. Accepted proposals live in the block's status only and never reach `reassess` or `resolve`.

There is no child workflow. A developer who wants the human step isolated wraps the block in their own child with `executeChild`. The Signal and Query handles are exported so client code and workflow code share them.

## Who owns which judgment

| Judgment | Owner | Layer |
| --- | --- | --- |
| Is this rubric well formed and unchanged? | Code: schema and content hash | 0002 |
| What did the applicant submit? | Intake activity, developer-supplied or passthrough | 0004 |
| How likely is each answer? | TypeSafe System One, at the pinned model | 0004 |
| Which route does the case take? | Code: the resolver | 0003 |
| Is the case too uncertain for automation? | Code: the uncertainty floor | 0003 |
| What happens after the route is known? | The developer's workflow, branching on the resolution | 0005 |
| What is the outcome of an uncertain case? | A named human, through a Signal | 0006 |
| Is anyone attending to this case? | Code: the SLA timer | 0006 |

## Decisions recorded across the plans

- Version ordering is segment-wise numeric. The spec said "version-string ordering" without defining it.
- The hash covers the parsed rubric, after defaults. Recorded in 0002 for the Python sibling.
- Uncertainty is a floor computed before rules, not a rule. Recorded in 0003 because ordering alone would be a foot-gun.
- Any uncertain question blocks every automatic route. A missing, wrong-primitive, or malformed answer is uncertain. Recorded in 0003 after adversarial review.
- The framework ships workflow building blocks and a reference example, not a workflow to register. The developer owns the workflow; Bulwark owns the pieces that carry the invariants. Pin-once is enforced by types (`reassess` takes the pinned rubric, never a reference) and by `assertAssessmentInvariants` in the test recipe. Recorded 2026-09-19, replacing the `AssessCase` and `AssessorReview` designs in 0005 and 0006.
- The human step is a block that registers Signals inside the caller's workflow, not a child workflow. Recorded in 0006; isolation is one `executeChild` away for developers who want it.
- Activity options are the developer's, with defaults from `bulwarkActivities`. Recorded in 0005 so the quick start is one line and nothing needs forking.
- Authoring is code-first, the runtime is artifact-first. Developers write state schema, static state, thresholds, and routing in TypeScript through `defineRubric`; it serialises to the JSON artifact this plane consumes. The runtime never reads routing from code. Plan 0007, [rubric-authorship.md](rubric-authorship.md).

## Open questions carried forward

- The disaster-grant fixture routing table exercises every condition kind but is not policy-sane beyond the `needs_senior` rules. 0003 answer sets author their own expected routes.
- `validate` reports refinement issues only when the base shape parses. A document missing a required field and carrying a bad rule reports only the missing field.
- The workflow id convention is documented, not enforced, so a developer can pick any id. Whether the testing entry should warn when a run's id does not include the pinned version. Default: no.
- Whether one SLA and one escalated state is enough. 0006 default: yes.
