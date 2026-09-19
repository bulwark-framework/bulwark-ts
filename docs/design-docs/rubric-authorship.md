# Rubric authorship

Status: accepted. This document says who writes each part of a rubric, who checks it, and what the agents may never do. It exists because the question "do the researchers build the whole rubric?" has a short answer that was spread across three documents. The answer is no. They write the questions. People write the policy.

Related: [rubric-artifact.md](rubric-artifact.md) for the field contract, [question-set-registry.md](question-set-registry.md) for the compile lifecycle, [runtime-plane.md](runtime-plane.md) for how the runtime consumes the result.

![Who authors each part of a rubric: three authors on the left, six rubric fields in the middle, three gates on the right](docs/diagrams/rubric-authorship.svg)

Source: [rubric-authorship.svg](../diagrams/rubric-authorship.svg).

## The rule in one sentence

An agent may propose what to ask. Only a person may say what the answers mean.

## Two surfaces, one artifact

There is an authoring surface and a runtime artifact, and they are not the same thing.

- **The artifact** is the JSON rubric. It is hashed, eval-gated, approved by a named human, pinned by every case, and read by the Python sibling. The runtime and the resolver read only this. Nothing in this document moves any field out of it.
- **The authoring surface** for everything that is not a question is TypeScript. A developer writes the state schema as a Zod object, static state as a constant, thresholds as numbers, and routing through a typed builder that autocompletes question ids. `defineRubric` serialises all of it, plus the researcher-emitted questions, into the artifact. Plan 0007 builds this.

So "the rubric contains only questions" is true of what is authored outside code, and false of the artifact. The artifact must carry routing, or pinning, eval coverage, and approval stop meaning anything.

```ts
export default defineRubric({
  scheme: "disaster-grant",
  state: z.object({ business: z.object({ location_lga: z.string() }) }),
  static: { policy: { declared_area_s11: "A business is in a declared area if ..." } },
  questions: fromCompile("./questions.json"),
  thresholds: { lo: 0.3, hi: 0.7, conf_floor: 0.6 },
  routing: (q) => [
    q.business_in_declared_area.band("no").route("auto_decline", "outside every declared area (s11)"),
    q.evidence_quality.scoreAbove(2).route("auto_approve", "itemised invoices cover the costs"),
  ],
  default: "assessor",
});
```

Zod 4 serialises with `z.toJSONSchema`, which emits `additionalProperties: false`, so a typo in a `required_paths` entry fails validation the same way it does today.

## Who writes what

| Rubric field | Written by | Why this author | Checked by |
| --- | --- | --- | --- |
| `state_schema` | Developer, as a Zod schema, serialised by `defineRubric` | The schema is the contract between the intake adapters, which are developer code, and the questions. A schema that changed on every compile would break every adapter. It is an input to compile, not an output. | Compiler resolves every `required_paths` entry against it |
| `static_state` | Scheme owner, as a constant in the `defineRubric` file | Fixed policy text and constants that every case shares. This is the law as quoted, so a person chooses the wording. | Compiler resolves paths; hash covers it |
| `questions` | Researcher agents | Reading a corpus and turning clauses into typed questions with citations is the agents' job. Each question carries the clause it operationalises and the state paths it needs. | Compiler: schema, citations resolve, no-match labels, dedupe. Then the eval gate. Then a human. |
| `routing`, `thresholds` | Scheme owner, through the typed routing builder | Routing is policy. A clear "no" on eligibility means decline; a middling probability means a person looks. Those are decisions about consequences, not about text. The spec writes every routing story from the scheme owner's point of view so that a threshold change is a reviewed version and not a code deploy. | Schema validation, then the eval gate's route agreement on the golden set, then a human |
| `model_pin` | Compile workflow | The exact model the eval gate ran against. Pinned so runtime answers come from the model that was tested. | Schema requires it; eval report records it |
| `provenance` | Compile workflow, then the approval Signal | Corpus hashes, eval id and result, researcher and contextualiser models, and the approver. Written by machinery, never by hand. | Schema requires eval pass and approver for `published` |
| `content_hash`, `version`, `status` | Compile workflow and the lifecycle | Identity and lifecycle. Never hand-written. | Every store verifies the hash |

## What the researcher agents do

1. Read the content-hashed corpus through the retriever.
2. Emit candidate questions. Each has a primitive (Noul, Choice, Score), criteria, one or more citations, and the `required_paths` it needs from the declared state schema.
3. Stop.

They do not answer questions. That is invariant 2 and the decision node's job. They do not write routes or thresholds. They do not change the state schema. If a question needs a path that is not in the schema, the compiler rejects the question. The scheme owner and developer then decide whether to extend the schema.

The bounded runtime researcher has the same limits, plus a cap. It runs only on the human route, emits at most K proposals, and a human accepts or rejects each. Accepted answers never reach the resolver.

## What the scheme owner does

1. Declares the state schema with the developer. The developer confirms the intake adapters can produce it.
2. Writes `static_state`: the policy text and constants the questions cite.
3. Writes `routing` and `thresholds`. The schema tells them at once if a rule names an unknown question or misuses a condition.
4. Owns the golden set: past determinations, tribunal outcomes, and authored edge cases with the expected route for each.
5. Reads the eval report. If the routing produces the wrong route on a golden case, the fix is in the routing or the questions, not in code.

## What the gates check

Every rubric passes three gates before it is `published`. Each catches a different class of mistake.

| Gate | Catches | Implemented |
| --- | --- | --- |
| Compiler and schema validation | Structural errors. A rule on a question that does not exist. A Choice without a no-match label. A path that does not resolve. A default of `auto_decline`. Every issue is reported, not the first. | Yes, plan 0002. `validate` in `packages/core/src/rubric/validate.ts` and `validateRouting` in the resolver. |
| Eval gate | Policy errors. Routing that sends a golden case the wrong way. Questions the model cannot answer stably. Regression against the published version. | No. Authoring plane, not yet planned. |
| Named human approval | Judgment. The approver sees the diff against the prior version, the eval report, and the citations, then sends the approval Signal. | No. Authoring plane. The schema already refuses `published` without `approved_by`, `approved_at`, and `golden_eval_result: "pass"`. |

## Why routing is not delegated to an agent

Three reasons, in order of weight.

1. **Accountability.** A determination letter cites the rule that fired. A regulator asks who decided that a 0.3 probability means decline. The answer must be a person's name in `provenance.approved_by`, not a model id.
2. **Stability.** Questions can be regenerated when the corpus changes. Routing should change only when policy changes. Separating the authors separates the change cadences.
3. **Testability.** The eval gate tests routing against expected routes on the golden set. If the same agent wrote both the questions and the routing, it could tune one to fit the other and pass the gate without the routing being right.

## What is still open

- Resolved: the state schema is a Zod object in the `defineRubric` source file, versioned with that file. The compile workflow takes the serialised JSON Schema as input and copies it into the artifact unchanged.
- Whether a policy team that cannot ship TypeScript needs a JSON authoring path for routing. Default: the JSON artifact remains valid input to every store and validator, so hand-authored JSON keeps working. No separate tool is planned until a deployment needs one.
- Whether a researcher may *propose* a routing rule as advisory text for the scheme owner to accept. Default: no. It adds a review burden and blurs the line this document draws.
- Whether thresholds should be fitted from labelled cases rather than chosen by hand. The assessment-graph note says the starting values come from the cookbook and are "to be replaced by values fitted on labelled cases". If fitting happens, code fits and a person approves the result. The author of record stays the scheme owner.
