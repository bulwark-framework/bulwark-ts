# Product sense

## Who it is for

Teams that assess applications, claims, or requests against written rules and must defend each outcome: government benefit and permit schemes, insurance claims, financial disputes and onboarding, local government approvals, medical prior authorisation and claims.

## What it promises

- A determination that can be explained as values against thresholds, with the rule each question came from.
- The same input produces the same answers. Judgments run on a model measured for stability, not on a generative model sampled at temperature 0.
- A scheme owner can change a threshold without touching a prompt, and every change is a reviewed, approved version.
- Every case is replayable from its event history.

## What it refuses to do

- Let a model output be the outcome.
- Regenerate questions per case on the automatic path.
- Publish a rubric nobody has approved.

## First-use path

1. Author a scheme: point the compile workflow at a corpus, get a draft rubric.
2. Build a golden set from past determinations.
3. Run the eval gate, read the report, approve.
4. Run cases with everything routed to a human. Watch agreement.
5. Widen the automatic band as measured precision allows.

Feature specs live in [product-specs/index.md](product-specs/index.md). None exist yet.
