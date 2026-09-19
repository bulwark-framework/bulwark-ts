# 0007 Typed authoring API

Status: blocked on [0003-resolver.md](0003-resolver.md) (needs the resolver's condition kinds and `validateRouting`). Independent of 0004 to 0006 and can run in parallel with them. Decision: [decisions-log.md](../../design-docs/decisions-log.md) "Code-first authoring, artifact-first runtime". Design: [rubric-authorship.md](../../design-docs/rubric-authorship.md). Release: a developer authors a rubric in TypeScript with types and autocomplete, and `defineRubric` emits the same JSON artifact the runtime already consumes.

## Scope

In: `defineRubric` in a new `authoring` entry point; Zod state schema serialised with `z.toJSONSchema`; a typed routing builder keyed by question id; `toArtifact()` that returns a validated rubric with `content_hash` computed; a `bulwark rubric build` CLI subcommand that writes the JSON file; the disaster-grant fixture re-authored through the builder as the reference example, producing a byte-identical `rubric.json`.

Out: the compile workflow and researchers (questions arrive as a JSON file or an object), approval, the registry, any change to the runtime or the resolver. The artifact schema does not change.

## Acceptance criteria

| # | Criterion | Proof |
| --- | --- | --- |
| 1 | `defineRubric({ scheme, version, state, static, questions, thresholds, routing, default, model_pin })` returns a `RubricDefinition` with `toArtifact(): Rubric` | Typecheck; test that `toArtifact()` output passes `validateWithHash` |
| 2 | `state` accepts a `ZodObject`; the artifact's `state_schema` equals `z.toJSONSchema(state)` and every `required_paths` entry in `questions` resolves against it | Test with the disaster-grant state schema authored in Zod; a question with a bad path fails at `toArtifact()` with `InvalidRubricError` |
| 3 | The routing builder exposes one accessor per question id, typed from `questions`, with only the condition methods valid for that primitive: `band` on Noul; `equals`, `isNoMatch`, `confidenceBelow` on Choice; `confidenceBelow`, `scoreBelow`, `scoreAbove` on Score | Type tests with `expectTypeOf`: `q.needs_senior.equals` is a type error; `q.insurance_overlap.equals("not_a_label")` is a type error |
| 4 | `default` is typed as `Exclude<Route, "auto_decline">` | Type test |
| 5 | The disaster-grant fixture authored through `defineRubric` produces JSON byte-identical to `packages/core/fixtures/disaster-grant/rubric.json`, including `content_hash` | Test compares canonical JSON and the file bytes after `JSON.stringify(x, null, 2)` |
| 6 | `bulwark rubric build <file.ts> --out <dir>` writes `<dir>/<scheme>/<version>.json` in the file-store layout and exits non-zero with every validation issue printed when the definition is invalid | Test runs the CLI in a subprocess on the fixture definition and on a broken one |
| 7 | `authoring` imports nothing from `@temporalio/*` or `@typesafe-ai/sdk` | Import guard test, same pattern as `resolver/purity.test.ts` |
| 8 | `provenance`, `content_hash`, and `status` cannot be set by the author: `defineRubric` sets `status: "draft"`, empty provenance, and computes the hash | Type test that the input type omits them; runtime test that a passed `content_hash` is ignored and recomputed |

## Decisions

- The builder is a thin serialiser. It contains no routing semantics. `validateRouting` from the resolver is the only rule check, so the builder cannot drift from the runtime.
- Questions are input, not authored here. `questions` accepts a `Record<string, Question>` or the path of a JSON file emitted by compile. The type of `q` in the routing callback is derived from that record, which is why questions must be known at type-check time. A JSON file path is loaded at build time and typed as `Record<string, Question>`; autocomplete then needs `as const` or a generated `.d.ts`. Default: recommend importing the JSON with `resolveJsonModule` so ids are literal types.
- `status` is always `draft` from the builder. Approval and publishing are the authoring plane's job.
- Loading a `.ts` definition in the CLI uses Node 22's `--experimental-strip-types` or a `tsx` dependency. Decide in the first task by testing whether strip-types handles the `.js` import suffixes this repo uses. If not, the CLI accepts a compiled `.js` file and documents `tsc` first.
- The CLI lives in `packages/core/src/cli/` using `commander`, which is already a dependency. It is the first CLI command; `compile`, `approve`, and `assess` come later.

## Tasks

- [ ] `packages/core/src/authoring/types.ts`: `RubricDefinitionInput`, `RubricDefinition`, builder types with per-primitive condition methods.
- [ ] `packages/core/src/authoring/routing-builder.ts`: `q` proxy over question ids. Type tests for criteria 3 and 4.
- [ ] `packages/core/src/authoring/define-rubric.ts`: `defineRubric`, `toArtifact`, Zod serialisation. Tests for criteria 1, 2, 8.
- [ ] `packages/core/fixtures/disaster-grant/rubric.definition.ts`: the fixture authored through the builder. Test for criterion 5.
- [ ] `packages/core/src/authoring/purity.test.ts`: criterion 7.
- [ ] `packages/core/src/cli/index.ts`, `cli/rubric-build.ts`: criterion 6. `bin` entry in `package.json`.
- [ ] `packages/core/src/authoring/index.ts`; `./authoring` export in `package.json`.
- [ ] `packages/core/README.md`: authoring section with the fixture definition as the example.
- [ ] `ARCHITECTURE.md`: new Authoring API row, implemented; CLI row gains `rubric build`. `docs/QUALITY_SCORE.md`.
- [ ] Adversarial review before commit; reviewer is told to find a definition that type-checks but produces an artifact `validateWithHash` rejects, and a way for an author to smuggle in `provenance` or `status`.

## Verification log

| Date | Command | Result |
| --- | --- | --- |

## Open questions

- Whether `questions` should also accept a Zod-like inline builder for hand-authored questions in small schemes that never run the compile workflow. Default: no; a plain `Record<string, Question>` literal already type-checks.
- Whether the Python sibling gets an equivalent `define_rubric` with Pydantic. Out of scope here; recorded so the artifact stays the contract between them.
