# Bulwark (TypeScript)

Bulwark is a framework for assessment workflows in regulated settings (government, finance, insurance, local government, medical). It compiles law and policy into versioned, human-approved question sets, answers them with TypeSafe System One models, and lets plain code make the determination. Temporal orchestrates every run.

Status: scaffolded. `packages/core` exists with the rubric schema; no workflows, activities, or stores yet. Every document under `docs/` describes intended design unless it says otherwise.

## Read first

- [ARCHITECTURE.md](ARCHITECTURE.md): the two planes (authoring, runtime), the registry between them, and which component owns which judgment.
- [docs/design-docs/index.md](docs/design-docs/index.md): decisions already made and their reasons.
- [docs/product-specs/index.md](docs/product-specs/index.md): feature specs. The first is the runtime plane.
- [docs/PLANS.md](docs/PLANS.md): how execution plans work; the active plan is the scaffold.
- [docs/QUALITY_SCORE.md](docs/QUALITY_SCORE.md): what has actually been verified. Currently nothing.

## Invariants

1. Only code decides. A model returns probabilities, scores, or a choice. The route function in code turns those into an outcome. No model output is ever an outcome by itself.
2. Researchers never answer their own questions. An LLM may formulate questions and cite the rule each one operationalises. Answering is the decision node's job.
3. Runtime pins one question-set version. A case run resolves a version once, records it, and never re-fetches. Upgrading a case is a new workflow instance.
4. No version publishes without the eval gate passing and a named human approving. Both are recorded in provenance.
5. Case-specific questions are advisory. The bounded runtime researcher runs only on the human route, emits at most K proposals, and a human accepts or rejects each. Accepted answers never enter the route function.
6. Every model call is a Temporal activity. Workflow code stays deterministic.

## Work loop

1. Read the active plan in `docs/exec-plans/active/`.
2. Implement one task. Add tests for the failure modes the task introduces.
3. Run the verification commands below. Record results in the plan.
4. Update `ARCHITECTURE.md` and `docs/QUALITY_SCORE.md` when a claim there changes from proposed to implemented.
5. Commit only when the user asks. Whoever did the work commits it.

## Verification

Harness check (works now):

```bash
bash scripts/check-harness.sh
```

Code checks (Node 22, pnpm, Vitest, Biome): `pnpm typecheck`, `pnpm lint`, `pnpm test`. Run `pnpm format` before lint. Do not invent others.

## Conventions

- Node 22, pnpm, TypeScript strict, Vitest, Biome. No Bun: Temporal workers do not run on it.
- Vocabulary: **scheme** (what is assessed against), **rubric** (a compiled, versioned question set), **case** (one assessment run), **gate** (eval gate, approval gate, human gate), **resolver** (the route function), **proposal** (bounded researcher output).
- External docs: TypeSafe at <https://docs.typesafe.ai/llms.txt> (fetch pages as `.md`), Temporal TypeScript SDK at <https://docs.temporal.io/develop/typescript>.
- Use the TypeSafe agent skill when writing any System One call.

## Related

- Python sibling planned at `bulwark-framework/bulwark-py`. Shares the rubric artifact schema. Not started.
- Design notes (private artifacts): Assessment Graph and Question Set Registry. Their content is summarised in `docs/design-docs/`.
