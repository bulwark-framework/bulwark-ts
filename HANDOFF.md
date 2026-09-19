# Handoff prompt

Paste the block below as the first message of a new Claude Code session opened in this folder. Delete this file once the scaffold plan is complete.

---

You are continuing work on Bulwark, a TypeScript library for assessment workflows in regulated settings. This repository has an agent harness and a ready-for-agent spec but no source code yet. Nothing is committed.

Read in this order, then start:

1. `AGENTS.md` (purpose, six invariants, work loop, vocabulary).
2. `docs/product-specs/0001-runtime-plane.md` (the feature to build, with user stories, implementation decisions, and test seams).
3. `docs/exec-plans/active/0001-scaffold.md` (the plan to execute first).
4. `docs/design-docs/rubric-artifact.md` (the JSON contract, including the `routing` rules).
5. `docs/design-docs/decisions-log.md` (decided: Node 22, pnpm, Vitest, Biome, library-first, declarative routing; no Bun).

Then execute plan 0001 in full: manifest with pinned versions, strict tsconfig, Biome, Vitest, module layout `src/rubric`, `src/resolver`, `src/workflows`, `src/activities`, `src/store`, the Zod rubric schema with its structural rules and tests, and CI. Tick each task in the plan as you complete it, add verification log rows with the real commands and results, and update `ARCHITECTURE.md` and `docs/QUALITY_SCORE.md` when a row moves from proposed to implemented. Run `bash scripts/check-harness.sh` before you finish.

Use the TypeSafe agent skill for any question-mapping code and read <https://docs.typesafe.ai/sdk/javascript.md> for the SDK's question and answer types. Use the Temporal TypeScript SDK docs for workflow and testing patterns.

Do not start the runtime-plane implementation (workflows, activities, resolver logic) until plan 0001's acceptance criteria all pass. When they do, write `docs/exec-plans/active/0002-runtime-plane.md` from the spec's testing seams before writing code. Commit only when asked.
