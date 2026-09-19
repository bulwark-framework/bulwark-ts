# 0001 Runtime plane

Status: ready-for-agent. Feature: the case-assessment loop as a library of Temporal primitives.

## Problem Statement

A team that assesses cases against written rules today has two bad options for automation. A generative model reads the case and writes a decision, which cannot be explained at review and changes between identical runs. Or hand-written rules code, which is explainable but cannot read a claim description or judge whether evidence is sufficient. Either way, nobody can say afterwards exactly which questions were asked, which version of the rules applied, and where the numbers fell.

## Solution

Bulwark's runtime plane is an npm library that a developer registers in their own Temporal worker. It gives them a durable `AssessCase` workflow that resolves and pins one **rubric** version, extracts submitted material into a state document through pluggable intake activities, asks every question in the rubric with one TypeSafe System One call, and routes the case with a **resolver** that is plain code driven by rules stored in the rubric. Cases that are uncertain go to a human through a child workflow that waits on Signals. Every input, answer, threshold, and route lands in event history under the pinned `scheme@version`.

## User Stories

1. As a developer, I want to install one core npm package and register its workflows and activities in my existing Temporal worker, so that I do not run a second service to adopt Bulwark. Out-of-the-box intake and researcher activities are optional packages I add when I want them.
2. As a developer, I want to start a case with a case id, a rubric reference, and the submitted artefacts grouped by facet, so that the workflow has everything it needs from the first event.
3. As a developer, I want the workflow to resolve a rubric reference to an exact version and content hash once, so that a case never changes rules mid-run.
4. As a developer, I want `latest-published` resolved to an exact version at case start and recorded, so that I can reproduce what was pinned.
5. As a developer, I want to supply my own intake activity per facet, so that my extraction stack (an LLM, an OCR service, a form parser) is my choice.
6. As a developer, I want a default intake that accepts already-structured JSON, so that I can run cases before I have written any extraction.
7. As a developer, I want intake activities to run in parallel, so that a case with many facets is not slowed by sequential extraction.
8. As a developer, I want an intake output that violates the rubric's state schema to fail with a typed error naming the facet and the violation, so that bad extraction cannot reach the decision step.
9. As a developer, I want the rubric's static state merged into the case state before the decision, so that policy extracts are the same text on every case.
10. As a developer, I want one TypeSafe call per decision covering every question in the rubric, so that latency and cost stay flat as the rubric grows.
11. As a developer, I want the decide activity to use the rubric's pinned model id, so that a model change is a rubric version, not an environment drift.
12. As a developer, I want the TypeSafe response model and token usage recorded with the answers, so that an alias resolving to a new version is visible.
13. As a developer, I want the resolver to be a pure function with no I/O, so that I can test it with fixture answers and no network.
14. As a scheme owner, I want routing rules stored inside the rubric, so that a threshold change is a reviewed version and not a code deploy.
15. As a scheme owner, I want routing rules to reference questions by id and express bands for Nouls, selected labels for Choices, and level or confidence floors for Scores, so that I can write rules without a developer.
16. As a scheme owner, I want rules evaluated in order with first match winning and a declared default route, so that I can reason about precedence.
17. As a scheme owner, I want every fired rule's reason recorded with the route, so that a determination letter can cite them.
18. As a scheme owner, I want a Noul between the low and high band thresholds to count as uncertain, so that 0.49 and 0.51 do not produce opposite automatic actions.
19. As a scheme owner, I want a Choice or Score whose confidence is below the rubric's floor to be treated as uncertain, so that a flat distribution never triggers an automatic outcome.
20. As a scheme owner, I want a Choice that selects the no-match label to be treated as uncertain, so that "none of the above" always reaches a person.
21. As an assessor, I want an uncertain case to arrive in my queue with every probability, score, confidence, and the rule citations attached, so that I answer only the open question and do not redo the closed ones.
22. As an assessor, I want to record my decision through a Signal carrying my identity, the outcome, and a reason, so that the determination is attributable.
23. As an assessor, I want to request more information from the applicant through a Signal naming the missing facets, so that the case pauses rather than being declined for thin evidence.
24. As an operator, I want a case waiting on an assessor to escalate after a configurable SLA, so that nothing sits unattended.
25. As an operator, I want the escalation to be visible as a route change in search attributes, so that a dashboard can list overdue cases.
26. As a developer, I want new evidence delivered through a Signal to re-run intake for the named facets only, so that unchanged facets are not re-extracted.
27. As a developer, I want the workflow to re-decide and re-route after new evidence, so that the case moves forward without a new workflow instance.
28. As a developer, I want the workflow to be deterministic and import no I/O, so that Temporal replay never diverges.
29. As a developer, I want search attributes for scheme, rubric version, and current route, so that I can query all open cases on a given version.
30. As a developer, I want a query that returns the case's current status, pinned version, and latest answers, so that a UI can render the case without reading history.
31. As an auditor, I want the final outcome record to include case id, scheme, version, content hash, every answer, the route, the fired reasons, the model that answered, and who decided, so that a review request is a single record.
32. As an auditor, I want event history to contain every activity input and result, so that a tribunal request is a history export.
33. As a developer, I want a rubric store interface with get-by-version and latest-published, so that I can back it with a file, a database, or the future registry service.
34. As a developer, I want in-memory and file-backed rubric stores included, so that tests and local runs need no infrastructure.
35. As a developer, I want the rubric schema exported with a validate function, so that I can check a rubric file before publishing it anywhere.
36. As a scheme owner, I want validation to reject a Choice without a no-match label, a required path that is not in the state schema, and missing threshold keys, so that a broken rubric cannot be pinned.
37. As a developer, I want the content hash computed over canonical JSON excluding status and approval fields, so that approving a version does not change its hash.
38. As a developer, I want the decide activity to verify the pinned rubric's hash before calling TypeSafe, so that a tampered store cannot change the questions.
39. As a developer, I want typed activity failures distinguishing intake schema violations, rubric not found, hash mismatch, and TypeSafe errors, so that retry policy and triage differ by cause.
40. As a developer, I want the TypeSafe credential read from the worker environment only, so that it never appears in workflow inputs or history.
41. As a developer, I want a time-skipping test environment recipe with mocked activities, so that I can test my own routing rules without live services.
42. As a developer, I want the resolver to reject a rule that references a question id not in the rubric, so that a typo cannot silently never fire.
43. As a scheme owner, I want an `auto_decline` route to be possible only from an explicit rule, so that the default route can never be a decline.
44. As a developer, I want upgrading a case to a newer rubric to be a new workflow instance started with the same case id and the new reference, so that the old run's history is untouched.
45. As an assessor, I want the review child workflow to accept an optional list of advisory proposals, so that the bounded researcher can plug in later without changing the review contract.

## Implementation Decisions

**Package shape.** One npm package, `@bulwark-framework/core`, inside a pnpm workspace (decided 2026-09-19; out-of-the-box activity packages come later and are out of scope here). Public entry points: rubric (schema, validate, hash), resolver (rules engine, band helpers), workflows (assess case, assessor review), activities (a factory that takes the developer's dependencies and returns Temporal activity implementations), store (interface plus in-memory and file implementations). Workflows are exported from a module that imports nothing with side effects, so it can be bundled into the Temporal workflow sandbox.

**Toolchain.** Node 22, pnpm, TypeScript strict, Vitest, Biome. Temporal workers do not run on Bun; the library targets what its users run.

**Rubric.** The artifact in the design docs, with one addition: a `routing` section holding an ordered list of rules and a default route. A rule has a condition on one question and a route with a reason. Conditions: Noul band (`no`, `uncertain`, `yes`), Choice label equals, Choice is no-match, Choice or Score confidence below floor, Score below or above a level. Rules evaluate in order; first match wins; the default applies when none match. `auto_decline` may appear only as a rule route, never as the default. Thresholds `lo`, `hi`, `conf_floor` are required. Validation additionally checks that every rule references an existing question id and that the condition type matches the question type.

**Content hash.** SHA-256 over canonical JSON (sorted keys, no whitespace) of the rubric with `status` and `provenance.approved_by` and `provenance.approved_at` removed.

**Rubric store.** Interface with `get(scheme, version)`, `latestPublished(scheme)`, and `put(rubric)`. `latestPublished` returns the highest published version by version-string ordering. In-memory store for tests; file store reads a directory of one JSON file per version. The future registry service implements the same interface over HTTP.

**Workflow input.** Case id, rubric reference (exact version or `latest-published`), artefacts keyed by facet name, review SLA duration, optional metadata. Facet names must match top-level keys of the rubric's state schema.

**Assess workflow.** Steps: resolve rubric (activity, verifies hash, returns full rubric); set search attributes; intake fan-out with `Promise.all`, one activity per facet; merge fragments with static state (pure, in workflow); decide (activity); resolve (pure, in workflow); if route is automatic, finalize; otherwise start the assessor review child workflow and await its result. The request-information route awaits an evidence Signal, re-runs intake for the named facets, re-merges, re-decides, re-resolves, and loops. Bounded loop count is a workflow input with a default.

**Assessor review child workflow.** Inputs: case id, state, answers, resolver output, optional advisory proposals. Signals: decision (identity, outcome, reason), request info (identity, facets, note). Query: status. Timer: SLA from parent input; on expiry the child sets its status to escalated, updates the route search attribute, and keeps waiting. Returns the human outcome to the parent.

**Search attributes.** Three custom keyword attributes: scheme, rubric version, current route. Registered by the developer on their namespace; the library documents the names.

**Decide activity.** Maps rubric questions to SDK question objects by type, calls `systemOne` with the merged state and the pinned model, returns answers keyed by question id plus response model and usage. Uses the SDK's retry policy for transport; the Temporal activity retry policy wraps it.

**Intake contract.** An activity receives case id, facet name, that facet's artefacts, and the state schema, and returns a JSON fragment for that facet. The library validates the fragment against the schema's sub-schema for the facet and raises a non-retryable application failure on violation. A structured-JSON passthrough intake is the default implementation.

**Errors.** Non-retryable application failures typed by name: intake schema violation, rubric not found, hash mismatch, invalid rubric. TypeSafe transport errors are retryable.

**Outcome record.** Case id, scheme, version, content hash, answers, route, reasons, response model, usage, decided-at, decided-by (system or the assessor identity), workflow id, run id.

**Determinism.** The workflows module imports only the resolver, the merge function, and types. Hashing, schema validation, and any SDK live in activities.

## Testing Decisions

A good test exercises a public seam with realistic inputs and asserts on observable results: the route and reasons, the outcome record, a Signal's effect on workflow state, a thrown typed error. Tests do not assert on internal call order or private helpers.

Three seams, highest first:

1. **Assess workflow** in the Temporal time-skipping test environment with mocked activities. The mock decide returns fixture answers. Cases: automatic approve path; automatic decline from an explicit rule; uncertain Noul routes to review and a decision Signal completes it; request-info Signal then evidence Signal re-runs intake for the named facet only and re-decides; SLA expiry escalates; hash mismatch fails the run with the typed error; intake schema violation fails with the facet named; search attributes set at start and updated on route change.
2. **Resolver** as a pure function with fixture answers and a fixture rubric. Cases: each condition type fires; first-match precedence; default route; no-match label routes to uncertain; confidence floor; rule referencing unknown question rejected at validation; `auto_decline` as default rejected.
3. **Rubric schema and hash.** The design-doc example validates. A Choice without a no-match label fails. A required path absent from the state schema fails. Hash is stable across key order and unchanged by approval fields.
4. **Live TypeSafe**, one test, skipped unless the API key is present. Runs the disaster-grant example from the design docs and asserts that the clear questions land outside the uncertain band and that the response model is recorded.

Prior art: none in this repository. Temporal's own samples for time-skipping tests with mocked activities are the reference pattern.

## Out of Scope

- Authoring plane: compile workflow, researchers, compiler beyond structural validation, eval gate, approval.
- Registry HTTP service and CLI.
- LLM-backed intake. Only the structured passthrough ships here. The default multimodal intake is planned as the `@bulwark-framework/intake` package under its own spec.
- Bounded runtime researcher. The review contract leaves a slot for it. Planned over the `AgentRunner` interface in the `activities-claude` and `activities-openai` packages under its own spec.
- Variants or rubric inheritance.
- Custom resolver functions supplied by the developer. Routing is declarative in the rubric only.
- Parking a failed facet for triage while others continue. A failed facet fails the run in this slice.
- Any assessor UI.
- Python package.

## Further Notes

- Vocabulary follows the decisions log: scheme, rubric, case, gate, resolver, proposal.
- The routing rules language is deliberately small. If a scheme needs arithmetic (quantum, caps, netting), that belongs in a later, separately specified computed-fields step, not in routing.
- Golden-set evaluation reuses the same resolver and decide activity later, so both must stay free of workflow-only dependencies.
- The disaster-grant example in the design docs is the canonical fixture for tests until a real scheme exists.
