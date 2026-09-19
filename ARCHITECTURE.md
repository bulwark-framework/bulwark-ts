# Architecture

Status: scaffolded. The rubric module (schema, validate, hash, errors) the rubric store (interface, in-memory, file), and the resolver are implemented; everything else is proposed. When a component lands, change its marker from "proposed" to "implemented" and link the entry point.

## System in one paragraph

Two Temporal-orchestrated planes share one registry. The **authoring plane** turns a scheme's corpus (Acts, regulations, guidelines) into a **rubric**: a versioned, immutable question set expressed in TypeSafe primitives, evaluated against a golden set and approved by a named human. The **runtime plane** runs one workflow per **case**: it resolves and pins a rubric version, extracts submitted material into a state document, calls TypeSafe System One once over all questions, and routes the case in plain code. A bounded runtime researcher may propose extra questions on the human route only.

## Diagram

![Bulwark architecture: authoring plane with corpus indexing, researcher agents, compiler, eval gate and human approval; a rubric store between the planes; runtime plane with resolve and pin, intake, merge, decide, resolver, assessor review child, and bounded researcher](docs/diagrams/architecture.svg)

Source: [docs/diagrams/architecture.svg](docs/diagrams/architecture.svg). Colour marks the owner of each judgment: orange researcher agents, purple retrieval, violet intake, teal TypeSafe, blue rubric store, grey human, black plain code. Monospace labels name the `@bulwark-framework` package.

## Packages

pnpm workspace. npm scope `@bulwark-framework`. Decided 2026-09-19, see [docs/design-docs/decisions-log.md](docs/design-docs/decisions-log.md).

| Package | Holds | Heavy dependencies |
| --- | --- | --- |
| `core` | Rubric schema, resolver, workflows, activity interfaces, rubric and corpus store interfaces, in-memory stores | `@temporalio/*`, `zod`, `@typesafe-ai/sdk` |
| `activities-claude` | `AgentRunner` adapter over the Claude Agent SDK. Default provider. | `@anthropic-ai/claude-agent-sdk` |
| `activities-openai` | `AgentRunner` adapter over the OpenAI Agents SDK. Full parity with the Claude adapter. | `@openai/agents` |
| `retrieval` | Contextual retrieval: chunking, contextualiser, embeddings, hybrid store, reranker, `IndexCorpus` workflow | `llamaindex`, `@llamaindex/qdrant`, `@llamaindex/openai`, `@llamaindex/cohere` |
| `intake` | Default multimodal intake activity, document conversion, OCR interface | `AgentRunner`, PDF and Word converters |

Only `core` exists today (scaffolded 2026-09-19). Each other package arrives with its own plan.

## Components

| Component | Plane | Role | Implementation | Tech stack | Status |
| --- | --- | --- | --- | --- | --- |
| Rubric store | shared | Interface with get-by-version, latest-published, put. In-memory and file implementations ship first; the registry service implements it later. | [`packages/core/src/store/`](packages/core/src/store/) (`types.ts` interface and `compareVersions`, `memory.ts`, `file.ts`) | TypeScript interface, in-memory and file adapters | implemented (plan 0002) |
| Corpus store | shared | Content-hashed documents keyed by corpus hash. In-memory and file implementations ship first. | `core/src/store/` | TypeScript interface, in-memory and file adapters | proposed |
| Rubric | shared | Schema, validation, content hash, declarative routing rules. | [`packages/core/src/rubric/`](packages/core/src/rubric/) (`schema.ts` schema and structural rules, `validate.ts`, `hash.ts`, `errors.ts`) | Zod, SHA-256 over canonical JSON | implemented (plan 0002); routing rule evaluation is the resolver, plan 0003 |
| Agent runner | shared | One interface for running an agent with Bulwark-defined tools and a required structured output. Built-in provider tools disabled; agents see only in-process MCP tools. | `core/src/agent/` interface; adapters in `activities-claude`, `activities-openai` | Claude Agent SDK (default), OpenAI Agents SDK; shared contract tests | proposed |
| Index corpus workflow | authoring | Temporal workflow keyed by corpus hash: chunk by section, contextualise each chunk with the agent provider, embed, upsert dense plus sparse. Index ref recorded in rubric provenance. | `retrieval/src/workflows/` | LlamaIndex.TS ingestion; Qdrant hybrid (dense plus native BM25 sparse); embeddings pluggable, OpenAI `text-embedding-3` default | proposed |
| Retriever | shared | Hybrid query, reciprocal-rank fusion, rerank. Exposed to agents as `retrieve` and `get_chunk` tools. | `retrieval/src/` | Qdrant hybrid query, Cohere rerank default, pluggable | proposed |
| Compile workflow | authoring | Temporal workflow: researchers, compiler, eval gate, approval Signal, publish. | `core/src/compile/` | Temporal | proposed |
| Researcher activity | authoring | Agent over the corpus index. Emits typed questions with citations and required state paths. Never answers them. Tools: `retrieve`, `get_chunk`, `emit_question`. Model id recorded in rubric provenance. | `core/src/compile/researcher.ts` over `AgentRunner` | Agent runner plus retriever | proposed |
| Compiler | authoring | Validates the merged question set: schema, citations resolve, no-match options present, state paths exist, dedupe. | `core/src/compile/compiler.ts` | Plain TypeScript, Zod | proposed |
| Eval gate | authoring | Runs golden cases N times through TypeSafe. Checks route agreement, stability, no regression, coverage, answer agreement. | `core/src/compile/eval.ts` | `@typesafe-ai/sdk` | proposed |
| Assess workflow | runtime | Temporal workflow: resolve and pin, intake fan-out, merge state, decide, route, human child workflow. | `core/src/workflows/` | Temporal | proposed |
| Intake activity | runtime | Developer-supplied extraction of one facet into the rubric's state schema. A structured-JSON passthrough ships in `core`. | `core/src/activities/` | Plain TypeScript, Zod | proposed |
| Default multimodal intake | runtime | Agent loop over a facet's artefacts, each file with its own disposition. Tools: `read_document` (native PDF and image input), `ocr` (fallback through the OCR interface), `emit_fragment`. Word converted to PDF, text extraction as fallback. Model id is worker config. | `intake/src/` over `AgentRunner` | Agent runner; native PDF and image inputs; Word to PDF converter | proposed |
| OCR interface | runtime | Non-LLM OCR boundary for scans the multimodal path cannot read. Interface only; no default implementation. Developers plug Textract, Azure Document Intelligence, or Tesseract. | `intake/src/ocr.ts` | TypeScript interface | proposed |
| Decide activity | runtime | One `systemOne` call over merged state and pinned questions with pinned model. | `core/src/activities/` | `@typesafe-ai/sdk` | proposed |
| Resolver | runtime | Pure routing from answers and the rubric's rules to a route and reasons; merge facet fragments with static state. Lives in workflow code. | [`packages/core/src/resolver/`](packages/core/src/resolver/) (`resolve.ts`, `bands.ts`, `merge.ts`, `validate-routing.ts`) | Plain TypeScript | implemented (plan 0003) |
| Bounded researcher | runtime | Agent proposes at most K extra questions when route is human. Same tool set and retriever as the authoring researcher. Output is advisory after human accept. | later, over `AgentRunner` | Agent runner plus retriever | proposed |
| CLI | both | `bulwark compile`, `bulwark approve`, `bulwark assess`, registry queries. | later | `commander` | proposed |

## Data flow

Indexing: corpus → `IndexCorpus` (chunk → contextualise → embed → upsert) → index ref keyed by corpus hash.

Authoring: corpus index → researchers (parallel, agent runner) → compiler → draft → eval gate → candidate → human approval Signal → published rubric in registry.

Runtime: case start → resolve rubric by ref, verify hash, pin → intake activities (parallel, cached by content hash) → merge case state with rubric `static_state` → `systemOne` → resolver → auto outcome, or human child workflow (with bounded researcher proposals), or request-information loop back to intake.

## Rubric artifact

The single shared contract. Fields: `scheme`, `version`, `status`, `content_hash`, `supersedes`, `state_schema`, `static_state`, `questions` (each with `type`, `instructions`, `criteria`, `cites`, `required_paths`), `routing` (ordered rules plus default route), `thresholds`, `model_pin`, `provenance`. Thresholds and model pin live in the artifact so changing either is a new version. Provenance additionally records the corpus index ref and the researcher and contextualiser model ids. Full example in [docs/design-docs/rubric-artifact.md](docs/design-docs/rubric-artifact.md).

## External services

| Service | Used by | Notes |
| --- | --- | --- |
| TypeSafe API (`@typesafe-ai/sdk`) | eval gate, decide activity, proposal answering | State is text only. Model pinned per rubric version. |
| Claude Agent SDK | researcher, bounded researcher, default intake, contextualiser | Default agent provider. Runs the Claude Code runtime as a subprocess on the worker; the CLI must be installed there. Built-in tools disabled. |
| OpenAI Agents SDK | same as above, when selected | Second agent provider. Same tools, same structured output, same contract tests. |
| Qdrant | retriever, index corpus workflow | Default hybrid store: dense vectors plus native BM25 sparse. In-memory store for tests. CI runs Qdrant as a service container. |
| Embedding provider | index corpus workflow, retriever | Pluggable. OpenAI `text-embedding-3` default. |
| Cohere rerank | retriever | Default reranker. Pluggable. |
| OCR service | default intake | Interface only. No default implementation. |
| Temporal | both planes | Workers require Node. Toolchain is Node 22, pnpm. |

## Boundaries

- Workflow code imports nothing that does I/O. Activities own all I/O.
- The registry is the only thing the two planes share. Runtime never calls compile-plane code.
- The resolver uses local answer types, band helpers, and rubric schema types and condition definitions. It must be testable with fixtures and no network.
- Provider SDK types stop at the activity boundary. `core` depends on no agent SDK, vector store, or document parser.
- Agents receive only Bulwark-defined tools. No filesystem, shell, or web access from inside an activity.
- Tests that need a provider key skip without it. Tests that need Qdrant run against the CI container.

## Known exceptions

None yet.

## Open questions

- Whether LlamaIndex.TS's Qdrant store exposes hybrid sparse-plus-dense queries. If not, `retrieval` uses LlamaIndex for ingestion and calls the Qdrant client directly for the hybrid query.
- Word-to-PDF conversion without LibreOffice on the worker. Fallback is text extraction.
