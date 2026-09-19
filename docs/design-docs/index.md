# Design docs

Decisions and research behind Bulwark. Each entry is the canonical home for its topic. Link here rather than restating.

| Document | Covers | Status |
| --- | --- | --- |
| [core-beliefs.md](core-beliefs.md) | The engineering principles the framework is built on and why. | accepted |
| [assessment-graph.md](assessment-graph.md) | The runtime graph: intake, state, decision, resolver, human loop. Summary of the Assessment Graph design note. | accepted |
| [question-set-registry.md](question-set-registry.md) | The authoring plane, rubric lifecycle, golden set and eval gate, runtime pinning, bounded researcher. Summary of the Question Set Registry design note. | accepted |
| [runtime-plane.md](runtime-plane.md) | The runtime plane as five layers, one per exec plan 0002 to 0006: rubric core, resolver, activities, workflow building blocks, human decision block. Why the framework ships blocks the developer composes rather than a workflow to register. Diagrams of the layers, one case end to end, and the resolver. | accepted, layers 0002 to 0004 implemented |
| [rubric-authorship.md](rubric-authorship.md) | Who writes each rubric field: researchers write questions, the scheme owner writes state schema, routing, and thresholds, the compile workflow writes provenance and hash. The three gates. Why routing is never delegated to an agent. | accepted |
| [rubric-artifact.md](rubric-artifact.md) | The rubric JSON contract with a worked example. | schema encoded in `packages/core/src/rubric/schema.ts` (plan 0002) |
| [decisions-log.md](decisions-log.md) | Dated decisions with the reason for each. | living |

Source material: TypeSafe docs (primitives, state, confidence, self-consistency cookbook), Temporal TypeScript SDK docs. See [../references/](../references/) for pinned pointers.
