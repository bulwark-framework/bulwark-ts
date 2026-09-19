# Question set registry

Summary of the Question Set Registry design note (private artifact). Supersedes the per-case researcher in [assessment-graph.md](assessment-graph.md).

## Two planes

Authoring plane, `CompileQuestionSet(scheme, corpusRef)`, runs per scheme change:

1. Researchers (LLM plus retrieval) read the content-hashed corpus and emit candidate questions with primitive, criteria, citation, required state paths.
2. Compiler validates: schema, citations resolve, every Choice has a no-match option, Score levels stand alone, state paths exist in the declared state schema, dedupe.
3. Eval gate runs the golden set N times through TypeSafe.
4. Human approval via Signal. The approver sees the diff against the prior version, the eval report, and citations.
5. Publish an immutable version to the registry.

Runtime plane, `AssessCase(caseId, questionSetRef)`, runs per case: resolve and pin, intake, merge `static_state`, decide, route.

## Lifecycle

`draft` → (eval passes, code gate) → `candidate` → (approve Signal, named human) → `published` → (discrete human task) → `deprecated`. Reject returns to draft with notes. Published versions are immutable. Deprecated versions remain fetchable by exact version.

## Golden set

Owned by the policy team. Required before first publish. A golden case has state, expected route, optionally expected banded answers, and `must_be_clear` question ids that may never land in the uncertain band.

Sources: de-identified past determinations, review and tribunal outcomes, authored edge cases per clause, promoted case proposals.

Gate checks: route agreement above the scheme floor, stability across N repeats under a spread ceiling, no regression against the published version, coverage (every question fires on some case, every case exercises a changed question), answer agreement where expected answers are set.

## Runtime binding

- First activity fetches the ref, verifies the content hash, returns the artifact. Nothing re-fetches.
- `qs_version` is a search attribute.
- Upgrade is a new workflow instance with the same case id and the new ref. Intake is cached by content hash. Old run history stays intact. Runs link to each other.
- Deprecation never touches a running case.
- Re-determination pins the original version by default.

## Bounded researcher

Runs only when the resolver has sent the case to a human. Sees state, pinned rubric, answers. Emits at most K proposals (K = 3 to start), validated by the compiler schema. A human accepts or rejects each. Accepted proposals are asked via a second `systemOne` call and shown as advisory. Accepted proposals queue for the next compile with the originating case as a candidate golden case.

## Registry API

| Endpoint | Does |
| --- | --- |
| `GET /question-sets/{scheme}/{version}` | Exact artifact, any status, cacheable forever by hash |
| `GET /question-sets/{scheme}/latest-published` | Resolves to an exact version; callers persist the resolved version |
| `POST /question-sets/{scheme}/compile` | Starts the compile workflow, idempotent on (scheme, corpus hashes, base) |
| `POST /question-sets/{scheme}/{version}/approve`, `/reject` | Sends the approval Signal, authenticated named human |
| `POST /question-sets/{scheme}/{version}/deprecate` | Removes from latest-published |
| `GET /question-sets/{scheme}/{version}/eval` | Eval report and heatmap |
| `GET /question-sets/{scheme}/diff?from=&to=` | Question-level diff |
| `POST /question-sets/{scheme}/proposals` | Runtime writes accepted proposals |

## Open before first publish

Agreement floor and spread ceiling per scheme, K, promotion count for a proposal to become compiled, day-to-day golden set owner.
