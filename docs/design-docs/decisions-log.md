# Decisions log

Dated. Newest first. Each entry says what was decided and why. Reversing a decision is a new entry, not an edit.

## 2026-09-19

**Out-of-the-box activities ship, behind interfaces.** Bulwark provides default Temporal activity implementations for the authoring researcher, the bounded runtime researcher, and intake, so adoption does not require a developer to write an LLM stack first. Every default sits behind an interface a developer can replace. Details in [ARCHITECTURE.md](../../ARCHITECTURE.md).

**Agent providers: Claude Agent SDK default, OpenAI Agents SDK second, one interface.** An `AgentRunner` interface with two adapters and one shared contract-test suite. Both adapters must pass it before either ships. Agents see only Bulwark-defined in-process MCP tools; provider built-ins (shell, filesystem, web) are disabled inside activities. The Claude Agent SDK runs a subprocess and requires the CLI on the worker; accepted for the tool loop it gives the researcher. Rejected: the plain Messages API (no loop), the Vercel AI SDK (abstraction cost across tool-calling quirks).

**Retrieval: contextual retrieval on LlamaIndex.TS, Qdrant hybrid default.** Chunk by section, contextualise each chunk with the agent provider, embed, store dense plus native BM25 sparse in Qdrant, fuse, rerank. Embeddings pluggable with OpenAI `text-embedding-3` default; Cohere rerank default. Indexing is its own `IndexCorpus` workflow keyed by corpus hash, and the index ref is recorded in rubric provenance. Rejected: whole-corpus-in-prompt (does not scale past one Act), Postgres (no native BM25 without an extension).

**Intake: multimodal agent loop with an OCR interface.** Default intake is an agent over a facet's artefacts, each file with its own disposition. PDFs and images go to the model natively; Word is converted to PDF with text extraction as fallback. A non-LLM OCR interface is the fallback when the multimodal path cannot read a scan. No default OCR implementation ships.

**Model id pinning.** Researcher and contextualiser model ids are recorded in rubric provenance because they shaped the questions. Intake model id is worker configuration because intake is developer-supplied and outside the pinned rubric. TypeSafe `model_pin` is unchanged.

**pnpm workspace, scope `@bulwark-framework`.** Packages: `core`, `activities-claude`, `activities-openai`, `retrieval`, `intake`. `core` stays free of agent SDKs, vector stores, and document parsers. The scaffold plan lays down the workspace with `core` only. Rejected: one package with optional peers (install story hides a large dependency tree).

**Live tests skip without keys; Qdrant runs in CI.** Provider and Cohere tests skip unless credentials are present. Qdrant runs as a CI service container so retrieval tests always run.

**Toolchain: Node 22, pnpm, Vitest, Biome.** Temporal TypeScript workers require Node-API native modules, `worker_threads`, `vm`, `AsyncLocalStorage`, and `async_hooks`; Bun is unsupported for the worker in the official SDK (temporalio/sdk-typescript issues 1334 and 1618). The library exports Temporal primitives, so it targets the runtime its users have. Bun rejected to avoid two runtimes in one repo.

**Library first.** One npm package exporting Temporal workflow and activity primitives, the rubric schema, the resolver, and a rubric store interface. No service, no HTTP, no CLI in the first slice.

**First slice: runtime plane.** Spec in [../product-specs/0001-runtime-plane.md](../product-specs/0001-runtime-plane.md).

**Routing is declarative inside the rubric.** An ordered rule list with a default route, evaluated first-match. Reason: thresholds and rules are then versioned and approved with the rubric. Custom resolver functions are out of scope.

**Name: Bulwark.** Cross-domain, protective connotation, not legal-sounding. Rejected: Merits (government-specific), Adjudicate (reads as heavy), Belay (unfamiliar), Tether (stablecoin conflict in finance). GitHub org `bulwark-framework`; this repo `bulwark-ts`; Python sibling `bulwark-py` (PyPI `bulwark-py`, import `bulwark`). Bare `bulwark` GitHub user is a dormant 2014 account.

**TypeScript first.** This repo starts before the Python one.

**Case-specific questions: bounded runtime researcher, human-filtered.** Runs only on the human route, at most K proposals, each accepted or rejected by a named human, accepted answers advisory only. Reason: a compiled rubric cannot anticipate every case, and a human filter makes LLM variance tolerable.

**Human approval before publish.** No rubric version reaches `published` without the eval gate passing and a named human approving via Signal. Identity recorded in provenance.

**Variants out of scope.** One rubric per scheme. No jurisdiction or cohort overlays.

**Retirement: pin and rerun.** Workflows resolve a version up front and pin it. Upgrading a case is a discrete task: a new workflow instance on the new version, rerun. Deprecation never mutates a running case.

**Golden set required before first publish.** Owned by the policy team. Without it the eval gate is theatre.

**Vocabulary.** scheme, rubric, case, gate, resolver, proposal. Chosen to avoid industry-specific terms so the framework reads the same in finance, insurance, government, and medical settings.

**Research moves to an authoring plane.** Compile once per scheme change, serve versions from a registry, never regenerate questions per case. Reason: closes the researcher-drift risk from the first design and shortens the runtime path to one model judgment.

**Routing and the state schema are authored by people, never by agents.** Researchers emit questions only. The scheme owner writes `routing`, `thresholds`, `state_schema`, and `static_state`; the compile workflow writes `provenance`, `model_pin`, and `content_hash`. Reason: routing is policy and must have a named human author; the state schema is the contract with developer-written intake adapters and cannot change per compile; an agent writing both questions and routing could tune one to the other and pass the eval gate. See [rubric-authorship.md](rubric-authorship.md). Recorded 2026-09-19.

**Code-first authoring, artifact-first runtime.** Developers author the state schema (Zod), static state, thresholds, and routing in TypeScript through a typed `defineRubric` builder. The builder serialises to the JSON rubric artifact, which stays the unit that is hashed, eval-gated, approved, pinned, and shared with the Python runtime. Routing never moves into runtime code. Reason: types, autocomplete on question ids, refactors, and unit tests for authors; pinning, eval coverage, named approval, and portability for the runtime. See [rubric-authorship.md](rubric-authorship.md) and plan 0007. Recorded 2026-09-19.

**Workflow building blocks, not a shipped workflow.** The runtime plane exports activities and sandbox-safe functions (`runAssessment`, `reassess`, `awaitHumanDecision`, `awaitEvidence`, an evidence budget, an outcome-record builder, a search-attribute helper) that the developer composes in their own Temporal workflow. No `AssessCase` or `AssessorReview` workflow ships. A reference workflow lives in tests and in the examples package. Reason: Bulwark is a framework; adopters own their workflow shape, ids, Queries, and outcome storage, and a canned workflow is forked the moment any of those differ, which loses the guarantee anyway. The invariants that live in control flow move to types (pinned rubric object, never a reference, after the first resolve) and to a history-based invariants check in the testing entry. See [runtime-plane.md](runtime-plane.md) and plans 0005 and 0006. Recorded 2026-09-19.

## Open

**LLM provider for researcher and intake.** Claude is the default candidate. Provider stays behind the activity boundary either way.

**Corpus store.** Content-hashed documents. Storage undecided.
