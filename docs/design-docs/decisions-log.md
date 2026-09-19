# Decisions log

Dated. Newest first. Each entry says what was decided and why. Reversing a decision is a new entry, not an edit.

## 2026-09-19

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

## Open

**LLM provider for researcher and intake.** Claude is the default candidate. Provider stays behind the activity boundary either way.

**Corpus store.** Content-hashed documents. Storage undecided.
