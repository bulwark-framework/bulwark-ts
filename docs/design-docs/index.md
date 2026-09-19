# Design docs

Decisions and research behind Bulwark. Each entry is the canonical home for its topic. Link here rather than restating.

| Document | Covers | Status |
| --- | --- | --- |
| [core-beliefs.md](core-beliefs.md) | The engineering principles the framework is built on and why. | accepted |
| [assessment-graph.md](assessment-graph.md) | The runtime graph: intake, state, decision, resolver, human loop. Summary of the Assessment Graph design note. | accepted |
| [question-set-registry.md](question-set-registry.md) | The authoring plane, rubric lifecycle, golden set and eval gate, runtime pinning, bounded researcher. Summary of the Question Set Registry design note. | accepted |
| [rubric-artifact.md](rubric-artifact.md) | The rubric JSON contract with a worked example. | draft, schema not yet encoded |
| [decisions-log.md](decisions-log.md) | Dated decisions with the reason for each. | living |

Source material: TypeSafe docs (primitives, state, confidence, self-consistency cookbook), Temporal TypeScript SDK docs. See [../references/](../references/) for pinned pointers.
