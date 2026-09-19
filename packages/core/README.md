# @bulwark-framework/core

## Authoring a rubric

`defineRubric` converts a typed definition into a validated rubric artifact.
The artifact contains a draft status, empty provenance, and a computed content hash.
Authors supply questions, state, thresholds, and routing policy.

This abridged example uses one question from the disaster-grant fixture:

```ts
import { z } from "zod";
import { defineRubric } from "@bulwark-framework/core/authoring";
import type { Question } from "@bulwark-framework/core/rubric";

const questions = {
  needs_senior: {
    type: "noul",
    instructions: "Does this case need a senior assessor under the escalation policy?",
    cites: ["Guideline 6.1"],
    required_paths: ["case.flags", "case.claimed_amount_aud", "policy.escalation_guideline_6_1"],
  },
} satisfies Record<string, Question>;

export default defineRubric({
  scheme: "disaster-grant",
  version: "2026.9.1",
  model_pin: "jev-1.13.0",
  state: z.object({
    case: z.object({ flags: z.array(z.string()), claimed_amount_aud: z.number() }),
  }),
  static: {
    policy: {
      escalation_guideline_6_1:
        "A senior assessor must see conflicts of interest, repeat claims, and amounts above the delegate's limit.",
    },
  },
  questions,
  thresholds: { lo: 0.3, hi: 0.7, conf_floor: 0.6 },
  routing: (q) => [
    q.needs_senior.band("yes").route("assessor", "a senior assessor must see this case"),
  ],
  default: "assessor",
});
```

The complete source is [rubric.definition.ts](fixtures/disaster-grant/rubric.definition.ts).
Routing accessors expose only conditions for each question's primitive.
Choice labels use literal keys from the criteria object.
`confidenceBelow()` uses the rubric's confidence floor.

Compile the definition with TypeScript before you run the CLI:

```sh
bulwark rubric build ./dist/rubric.definition.js --out ./rubrics
```

This command writes `./rubrics/disaster-grant/2026.9.1.json`.
Validation errors appear on stderr, one issue per line, with exit code 1.
Node type stripping does not map this repository's `.js` imports to `.ts` sources.
No `tsx` loader is required.

To build the complete fixture from this repository, run these commands at the repository root:

```sh
pnpm --filter @bulwark-framework/core build
pnpm --filter @bulwark-framework/core exec tsc -p tsconfig.json --noEmit false --outDir dist/fixture-build
node packages/core/dist/cli/index.js rubric build packages/core/dist/fixture-build/fixtures/disaster-grant/rubric.definition.js --out ./rubrics
```

The CLI emits drafts. The fixture's separate [publication step](fixtures/disaster-grant/README.md) adds its recorded provenance.

## Write your workflow

Bulwark exports building blocks. You register your own workflow with Temporal.
The reference below is copied verbatim from `test/workflows/reference.ts`, including its repository-relative imports.
In your application, replace `../../src/workflows/index.js` with `@bulwark-framework/core/workflows`.
The pending arm is a placeholder; plan 0006 adds the human and evidence blocks.
`maxEvidenceLoops` is reserved for that plan and has no effect here.

```ts
import {
  ActivityFailure,
  ApplicationFailure,
  setWorkflowOptions,
  upsertSearchAttributes,
} from "@temporalio/workflow";
import type { AssessmentInput } from "../../src/workflows/index.js";
import {
  buildOutcomeRecord,
  bulwarkActivities,
  bulwarkSearchAttributes,
  InvalidInputError,
  isAutomatic,
  runAssessment,
} from "../../src/workflows/index.js";

export async function assessCase(input: AssessmentInput & { maxEvidenceLoops?: number }) {
  const activities = bulwarkActivities();
  // Observe the pin at resolution without resolving a second time.
  const result = await runAssessment(
    {
      intake: activities.intake,
      decide: activities.decide,
      async resolveRubric(ref) {
        const resolved = await activities.resolveRubric(ref);
        upsertSearchAttributes(
          bulwarkSearchAttributes(
            {
              rubric: resolved.rubric,
              version: resolved.resolvedVersion,
              contentHash: resolved.contentHash,
            },
            "assessing",
          ),
        );
        return resolved;
      },
    },
    input,
  ).catch((error) => {
    // Expose the activity's typed application failure at the workflow boundary.
    if (error instanceof ActivityFailure && error.cause instanceof ApplicationFailure)
      throw error.cause;
    throw error;
  });
  upsertSearchAttributes(bulwarkSearchAttributes(result.pinned, result.resolution.route));
  if (isAutomatic(result.resolution)) return buildOutcomeRecord(result, "system");
  // Plan 0006 replaces this arm with human and evidence blocks.
  return {
    pending: result.resolution.route,
    ...buildOutcomeRecord(result, "pending"),
  };
}
setWorkflowOptions({ failureExceptionTypes: [InvalidInputError] }, assessCase);
```

`setWorkflowOptions` makes `InvalidInputError` fail the execution. Without it, an ordinary error fails a workflow task and Temporal retries that task.
The reference unwraps activity application failures so callers can inspect `WorkflowFailedError.cause.type` directly.
The resolve wrapper records the pin without a second lookup; the second upsert records the resolver's route.

Artefacts are keyed by facet. A value with a `json` key is passed to intake unchanged; other values become `{ json: value }`.
Intake returns the facet's value, validated against `state_schema.properties[facet]`. The merge block nests it under the facet key, applies facets in input enumeration order, and applies static state last.

`reassess(activities, previous, facets)` accepts no rubric reference and no separate pin. It extracts only the supplied facets.
The case id and the pinned rubric both come from `previous`, so a re-assessment can neither resolve nor substitute a different version.
Each intake fragment is the facet's value and lands at `state.<facet>`. Facets not named keep their previous value.

```ts
const updated = await reassess(activities, result, newFacets);
```

`createEvidenceBudget()` permits three calls to `consume()` by default. A zero maximum permits none.
Negative, fractional, non-finite, and unsafe integer maxima throw `RangeError`.
`isAutomatic` returns false if the resolution contains any uncertain answers.
Outcome timestamps use Temporal's deterministic `Date.now()`, not workflow start time.

Register activities on your worker. Keep the store and TypeSafe credentials on the worker side:

```ts
import { createRequire } from "node:module";
import { Worker } from "@temporalio/worker";
import { createActivities } from "@bulwark-framework/core/activities";
import { FileRubricStore } from "@bulwark-framework/core/store";

const worker = await Worker.create({
  taskQueue: "assessments",
  workflowsPath: createRequire(import.meta.url).resolve("./workflows.js"),
  activities: createActivities({ store: new FileRubricStore("./rubrics") }),
});
await worker.run();
```

Register the three keyword search attributes in your namespace before starting cases:

```sh
temporal operator search-attribute create --namespace default --name BulwarkScheme --type Keyword
temporal operator search-attribute create --namespace default --name BulwarkRubricVersion --type Keyword
temporal operator search-attribute create --namespace default --name BulwarkRoute --type Keyword
```

Use workflow IDs of the form `assess-<caseId>-<scheme>@<version>` with an exact version.
Upgrading a case starts a new workflow instance with a new version and ID; the old history stays intact.
If using `latest-published`, choose a unique ID before starting; the exact pin is available only after resolution.

Install `@temporalio/testing` and `@temporalio/worker` version 1.24.0 to use the optional testing entry point.
This recipe uses your rubric and answer fixtures, with no live model call:

```ts
import { createRequire } from "node:module";
import { assertAssessmentInvariants, createTestEnvironment, mockActivities } from "@bulwark-framework/core/testing";

const activities = mockActivities({ rubric, answers });
const test = await createTestEnvironment({
  activities,
  workflowsPath: createRequire(import.meta.url).resolve("./workflows.ts"),
});
try {
  await test.worker.runUntil(async () => {
    const handle = await test.client.start("assessCase", {
      taskQueue: test.taskQueue,
      workflowId: `assess-${input.caseId}-${rubric.scheme}@${rubric.version}`,
      args: [input],
    });
    const outcome = await handle.result();
    assertAssessmentInvariants(await handle.fetchHistory());
    // Assert on outcome and activities.calls in your test framework.
  });
} finally {
  // runUntil stops the worker before the environment closes.
  await test.teardown();
}
```

`mockActivities` records each call. Its optional `intakeDelay(input)` callback can await a shared barrier to test fan-out.
The history helper detects multiple rubric resolutions and any decide whose rubric hash differs from the pin that `resolveRubric` returned.
It uses the default payload converter; encrypted or custom payload codecs need decoding before this check.
