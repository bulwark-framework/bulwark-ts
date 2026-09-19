# Core beliefs

Durable principles. Change one only with a dated entry in [decisions-log.md](decisions-log.md).

## 1. Only code decides

A model returns a probability, a score, or a choice. Code turns that into an outcome using thresholds a scheme owner can read, test, and change. A determination that cannot be explained as "value X fell on side Y of threshold Z" is not defensible at review.

## 2. Judgments and language work are different jobs

Reading a scanned document into a schema, or reading section 9 and deciding it implies a "which item overlaps" question, is language work. Generative models do it well and their variance is tolerable because a schema or a human checks the output. Deciding whether a condition holds is a judgment. The TypeSafe self-consistency cookbook showed LLMs drifting on identical input at temperature 0 while the System One model held to a per-question standard deviation near 0.01. Judgments run on the model built for stable, calibrated answers.

## 3. Compile once, decide many times

Research is expensive, slow, and variable. It runs when the scheme changes, not when a case arrives. The runtime path contains one model judgment and no generative step on the automatic route.

## 4. Versions are immutable and pinned

A rubric version is content-addressed and never mutated. A case run pins one version and finishes on it. Deprecation removes a version from "latest" only. A re-determination compares like with like by default.

## 5. Two gates before publish

A mechanical eval gate that cannot be waived, then a named human. The human approves on evidence (diff, eval report, citations), not on raw compiler output.

## 6. Uncertainty is a route, not a failure

A probability inside the uncertain band goes to a person with the numbers attached. Forcing yes or no at 0.5 turns 0.49 and 0.51 into opposite actions. Bands have edges too, so thresholds come from labelled cases and the asymmetric cost of wrong approvals versus wrong declines.

## 7. Escape hatches are bounded and human-filtered

A compiled rubric cannot anticipate every case. The runtime researcher exists for that, with three invariants: it cannot change the pinned version, cannot affect an automatic route, and cannot be acted on without a named human accepting its proposal.

## 8. Audit is a by-product, not a feature

Temporal event history holds every activity input and result. A case record says `scheme@version` and the registry reproduces exactly what was asked. A tribunal request is a history export.

## 9. Typed is not true

A typed response guarantees the interface, not correctness. No automatic route switches on until the scheme's golden set shows the precision to justify it. Start with everything to a human and widen the automatic band as measured.
