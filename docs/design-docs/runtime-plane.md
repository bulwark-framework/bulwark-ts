# Runtime plane

Status: accepted. Layers 0002 and 0003 are implemented and in review. Layers 0004 to 0006 are planned. This document is the single map of the runtime plane. The exec plans hold the acceptance criteria. The product spec holds the user stories. Link here rather than restating.

Spec: [0001-runtime-plane.md](../product-specs/0001-runtime-plane.md). Plans: [0002](../exec-plans/active/0002-rubric-core.md), [0003](../exec-plans/active/0003-resolver.md), [0004](../exec-plans/active/0004-activities.md), [0005](../exec-plans/active/0005-assess-workflow.md), [0006](../exec-plans/active/0006-assessor-review.md). Background: [assessment-graph.md](assessment-graph.md), [rubric-artifact.md](rubric-artifact.md).

## What the runtime plane is

The runtime plane is one npm package, `@bulwark-framework/core`, that a developer registers in their own Temporal worker. It takes a case, pins one rubric version, extracts the submitted material into a state document, asks every question in one TypeSafe System One call, and routes the case with plain code. Uncertain cases go to a human through a child workflow. Every input, answer, threshold, and route lands in Temporal event history under the pinned `scheme@version`.

Five things never change:

1. Only code decides. A model returns probabilities, labels, levels, and confidences. The resolver turns them into a route.
2. A case resolves one rubric version once and never re-fetches it.
3. Every model call and every I/O is a Temporal activity. Workflow code stays deterministic.
4. Uncertainty always reaches a person. No rule ordering can bypass this.
5. Errors are typed. Retry policy and triage differ by cause.

## Layers

![Runtime plane layers: five stacked boxes, one per exec plan, from rubric core at the bottom to assessor review at the top](docs/diagrams/runtime-plane-layers.svg)

Source: [runtime-plane-layers.svg](../diagrams/runtime-plane-layers.svg).

Each exec plan is one layer. A layer imports only from the layers below it. The order is also the order the PR stack merges in.

| Layer | Plan | Modules | Owns | Status |
| --- | --- | --- | --- | --- |
| Rubric core and stores | 0002 | `rubric/schema.ts`, `validate.ts`, `hash.ts`, `errors.ts`, `store/types.ts`, `memory.ts`, `file.ts` | The rubric contract, its identity (content hash), its storage, and the error hierarchy every later layer throws | in review, [PR #4](https://github.com/bulwark-framework/bulwark-ts/pull/4) |
| Resolver | 0003 | `resolver/answers.ts`, `bands.ts`, `resolve.ts`, `validate-routing.ts`, `merge.ts` | Turning answers into a route. Merging facet state. Pure code with no I/O | in review, [PR #5](https://github.com/bulwark-framework/bulwark-ts/pull/5) |
| Activities | 0004 | `activities/factory.ts`, `resolve-rubric.ts`, `intake.ts`, `decide/`, `failures.ts` | Every side effect: store reads, intake extraction, the TypeSafe call. Error wrapping for Temporal | planned |
| Assess workflow | 0005 | `workflows/assess-case.ts`, `types.ts`, `test/helpers/env.ts` | The deterministic case pipeline on the automatic routes. Search attributes. Status query. Test recipe | planned |
| Assessor review and evidence loop | 0006 | `workflows/assessor-review.ts`, `signals.ts`, the loop in `assess-case.ts` | The human gate. Signals, SLA, escalation, bounded evidence loop | planned |

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

### Assess workflow (0005)

![One case through the runtime plane: resolve rubric, intake fan-out, merge, decide, resolve, then the three route families with the child workflow and the evidence loop](docs/diagrams/runtime-plane-case-flow.svg)

Source: [runtime-plane-case-flow.svg](../diagrams/runtime-plane-case-flow.svg).

`AssessCase` runs the pipeline in the diagram. Resolve once. Set search attributes. Fan out intake with `Promise.all`, one activity per facet. Merge in workflow code. Decide. Resolve in workflow code. On an automatic route, write the outcome record with `decidedBy: system`. On a human route, 0005 completes with a `pending_human` stub that 0006 removes.

The workflow id is `assess-<caseId>-<scheme>@<version>`, so upgrading a case to a newer rubric is a new instance by construction. Search attributes `BulwarkScheme`, `BulwarkRubricVersion`, and `BulwarkRoute` let a dashboard list open cases by version and route. The `status` query returns phase, pinned version, hash, and the latest answers.

`workflows/index.ts` imports only the resolver, `merge`, and types. A test bundles it with `bundleWorkflowCode` to prove it fits the Temporal sandbox.

### Assessor review and evidence loop (0006)

On route `assessor`, `AssessCase` starts `AssessorReview` as a child with the full resolver output: every probability, label, level, confidence, and reason. The child waits on two Signals. `decision({ identity, outcome, reason })` completes it. `requestInfo({ identity, facets, note })` returns it to the parent. An SLA timer sets status `escalated` and updates `BulwarkRoute`, then keeps waiting.

The child never touches an activity. On `requestInfo`, or on a resolver route of `request_info`, the parent waits for an `evidence({ facets })` Signal, re-runs intake for the named facets only, re-merges, re-decides, and re-resolves. The loop is bounded by `maxEvidenceLoops`, default 3. Exceeding it routes to `assessor` with reason `evidence_loops_exhausted`.

The child has a proposals slot for the bounded researcher. Nothing produces proposals in this plane. Accepted proposals never reach the resolver.

## Who owns which judgment

| Judgment | Owner | Layer |
| --- | --- | --- |
| Is this rubric well formed and unchanged? | Code: schema and content hash | 0002 |
| What did the applicant submit? | Intake activity, developer-supplied or passthrough | 0004 |
| How likely is each answer? | TypeSafe System One, at the pinned model | 0004 |
| Which route does the case take? | Code: the resolver | 0003 |
| Is the case too uncertain for automation? | Code: the uncertainty floor | 0003 |
| What is the outcome of an uncertain case? | A named human, through a Signal | 0006 |
| Is anyone attending to this case? | Code: the SLA timer | 0006 |

## Decisions recorded across the plans

- Version ordering is segment-wise numeric. The spec said "version-string ordering" without defining it.
- The hash covers the parsed rubric, after defaults. Recorded in 0002 for the Python sibling.
- Uncertainty is a floor computed before rules, not a rule. Recorded in 0003 because ordering alone would be a foot-gun.
- Any uncertain question blocks every automatic route. A missing, wrong-primitive, or malformed answer is uncertain. Recorded in 0003 after adversarial review.
- The child workflow never runs activities. On `request_info` it returns to the parent. Recorded in 0006 to keep the child trivially deterministic.
- Activity options are workflow inputs with defaults, not constants. Recorded in 0005 so developers tune without forking.
- Authoring is code-first, the runtime is artifact-first. Developers write state schema, static state, thresholds, and routing in TypeScript through `defineRubric`; it serialises to the JSON artifact this plane consumes. The runtime never reads routing from code. Plan 0007, [rubric-authorship.md](rubric-authorship.md).

## Open questions carried forward

- The disaster-grant fixture routing table exercises every condition kind but is not policy-sane beyond the `needs_senior` rules. 0003 answer sets author their own expected routes.
- `validate` reports refinement issues only when the base shape parses. A document missing a required field and carrying a bad rule reports only the missing field.
- Workflow id when the version is unknown at start. 0005 starts with the rubric reference and records the resolved id in search attributes.
- Whether one SLA and one escalated state is enough. 0006 default: yes.
