# Architecture

Status: proposed. Nothing below is implemented. When a component lands, change its marker from "proposed" to "implemented" and link the entry point.

## System in one paragraph

Two Temporal-orchestrated planes share one registry. The **authoring plane** turns a scheme's corpus (Acts, regulations, guidelines) into a **rubric**: a versioned, immutable question set expressed in TypeSafe primitives, evaluated against a golden set and approved by a named human. The **runtime plane** runs one workflow per **case**: it resolves and pins a rubric version, extracts submitted material into a state document, calls TypeSafe System One once over all questions, and routes the case in plain code. A bounded runtime researcher may propose extra questions on the human route only.

## Components

| Component | Plane | Role | Implementation | Status |
| --- | --- | --- | --- | --- |
| Rubric store | shared | Interface with get-by-version, latest-published, put. In-memory and file implementations ship first; the registry service implements it later. | `src/store/` | proposed |
| Rubric | shared | Schema, validation, content hash, declarative routing rules. | `src/rubric/` | proposed |
| Compile workflow | authoring | Temporal workflow: researchers, compiler, eval gate, approval Signal, publish. | `src/compile/` | proposed |
| Researcher activity | authoring | LLM plus retrieval over the corpus. Emits typed questions with citations and required state paths. Never answers them. | `src/compile/researcher.ts` | proposed |
| Compiler | authoring | Validates the merged question set: schema, citations resolve, no-match options present, state paths exist, dedupe. | `src/compile/compiler.ts` | proposed |
| Eval gate | authoring | Runs golden cases N times through TypeSafe. Checks route agreement, stability, no regression, coverage, answer agreement. | `src/compile/eval.ts` | proposed |
| Assess workflow | runtime | Temporal workflow: resolve and pin, intake fan-out, merge state, decide, route, human child workflow. | `src/workflows/` | proposed |
| Intake activity | runtime | Developer-supplied extraction of one facet into the rubric's state schema. A structured-JSON passthrough ships as default. | `src/activities/` | proposed |
| Decide activity | runtime | One `systemOne` call over merged state and pinned questions with pinned model. | `src/activities/` | proposed |
| Resolver | runtime | Pure function from answers and the rubric's routing rules to a route and reasons. Lives in workflow code. | `src/resolver/` | proposed |
| Bounded researcher | runtime | LLM proposes at most K extra questions when route is human. Output is advisory after human accept. | later | proposed |
| CLI | both | `bulwark compile`, `bulwark approve`, `bulwark assess`, registry queries. | later | proposed |

## Data flow

Authoring: corpus → researchers (parallel) → compiler → draft → eval gate → candidate → human approval Signal → published rubric in registry.

Runtime: case start → resolve rubric by ref, verify hash, pin → intake activities (parallel, cached by content hash) → merge case state with rubric `static_state` → `systemOne` → resolver → auto outcome, or human child workflow (with bounded researcher proposals), or request-information loop back to intake.

## Rubric artifact

The single shared contract. Fields: `scheme`, `version`, `status`, `content_hash`, `supersedes`, `state_schema`, `static_state`, `questions` (each with `type`, `instructions`, `criteria`, `cites`, `required_paths`), `routing` (ordered rules plus default route), `thresholds`, `model_pin`, `provenance`. Thresholds and model pin live in the artifact so changing either is a new version. Full example in [docs/design-docs/rubric-artifact.md](docs/design-docs/rubric-artifact.md).

## External services

| Service | Used by | Notes |
| --- | --- | --- |
| TypeSafe API (`@typesafe-ai/sdk`) | eval gate, decide activity, proposal answering | State is text only. Model pinned per rubric version. |
| LLM provider (undecided) | researcher, intake, bounded researcher | Claude is the default candidate. Provider is a boundary; no provider types leak past activities. |
| Temporal | both planes | Workers require Node. Toolchain is Node 22, pnpm. |
| Corpus store (undecided) | researcher | Content-hashed documents. |

## Boundaries

- Workflow code imports nothing that does I/O. Activities own all I/O.
- The registry is the only thing the two planes share. Runtime never calls compile-plane code.
- The resolver imports only answer types and thresholds. It must be testable with fixtures and no network.
- Provider SDK types stop at the activity boundary.

## Known exceptions

None yet.
