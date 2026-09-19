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
