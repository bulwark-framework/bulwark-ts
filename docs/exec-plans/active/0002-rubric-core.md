# 0002 Rubric core and stores

Status: active, unblocked 2026-09-19 ([0001-scaffold.md](../completed/0001-scaffold.md) complete). Spec: [0001-runtime-plane.md](../../product-specs/0001-runtime-plane.md) stories 33 to 37, 39 (error types only). First shippable release: a developer can validate, hash, and load rubric files with no Temporal and no TypeSafe.

## Scope

In: `validate` and `hash` exported from `rubric`; the canonical fixture rubric; the `RubricStore` interface with in-memory and file implementations; the typed error hierarchy used by every later plan.

Out: any Temporal code, any TypeSafe call, the resolver (0003), activities (0004).

## Acceptance criteria

| # | Criterion | Proof |
| --- | --- | --- |
| 1 | `hash(rubric)` is SHA-256 over canonical JSON with `status`, `provenance.approved_by`, `provenance.approved_at` removed | Test: two rubrics differing only in key order and approval fields hash equal; changing a threshold changes the hash; known-vector test against a hand-computed digest |
| 2 | `validate(json)` returns a typed rubric or a `InvalidRubricError` listing every violation, not just the first | Test: a rubric with two violations reports both |
| 3 | `RubricStore` interface has `get(scheme, version)`, `latestPublished(scheme)`, `put(rubric)` | Typecheck against the interface with both implementations |
| 4 | `latestPublished` returns the highest `published` version by version-string ordering and ignores `draft`, `candidate`, `deprecated` | Test with versions `2026.9.1`, `2026.10.1` (draft), `2026.9.10`; expect `2026.9.10` |
| 5 | File store reads a directory of one JSON file per version and rejects a file whose content hash does not match `content_hash` | Test with a fixture directory and one tampered file; expect `HashMismatchError` naming scheme and version |
| 6 | `get` of an unknown version throws `RubricNotFoundError` | Test on both stores |
| 7 | The disaster-grant fixture rubric exists as JSON, validates, and covers all three primitives and every routing condition type | Test loads `fixtures/disaster-grant/rubric.json`; a second test asserts each condition kind appears at least once in `routing.rules` |

## Decisions

- Version-string ordering is segment-wise numeric on dot-separated integers (`2026.9.10` > `2026.9.2`). Non-numeric segments compare as strings after numeric ones. Recorded here because the spec says "version-string ordering" without defining it.
- Errors extend one `BulwarkError` base with a stable `name` per class: `InvalidRubricError`, `RubricNotFoundError`, `HashMismatchError`, `IntakeSchemaViolationError` (used in 0004). Temporal `ApplicationFailure` wrapping happens in activities, not here, so the classes stay usable outside Temporal.
- Canonical JSON: recursively sorted object keys, no whitespace, arrays in given order, `JSON.stringify` number formatting. No external canonicalisation library.
- The disaster-grant fixture is authored in this plan from the prose in [assessment-graph.md](../../design-docs/assessment-graph.md): ten questions, eligibility Nouls, an insurance-overlap Choice with a no-match label, an evidence-quality Score, a `needs_senior` Noul. Section citations are illustrative.

## Tasks

- [x] `packages/core/src/rubric/hash.ts`: `canonicalJson`, `hash`, `stripVolatileFields`. Tests for criterion 1.
- [x] `packages/core/src/rubric/errors.ts`: `BulwarkError` and the four subclasses with `name`, `details`. Tests that `name` survives `JSON.stringify` round trip.
- [x] `packages/core/src/rubric/validate.ts`: wraps the 0001 Zod schema, collects all issues into `InvalidRubricError`. Tests for criterion 2.
- [x] `packages/core/fixtures/disaster-grant/rubric.json` plus `packages/core/fixtures/disaster-grant/README.md` describing each question and rule. Tests for criterion 7.
- [x] `packages/core/src/store/types.ts`: `RubricStore`, `RubricRef` (`{ scheme, version }` or `{ scheme, latest: 'published' }`), `compareVersions`. Tests for the ordering decision.
- [x] `packages/core/src/store/memory.ts`: in-memory store. Tests for criteria 4 and 6.
- [x] `packages/core/src/store/file.ts`: file store. Tests for criteria 4, 5, 6 with a fixture directory.
- [x] Export from `rubric/index.ts` and `store/index.ts`. Update `packages/core/package.json` `exports`.
- [x] `ARCHITECTURE.md`: Rubric store row to implemented with entry point; Rubric row gains hash and validate.
- [x] `docs/QUALITY_SCORE.md`: rubric schema validation row updated with date and command.
- [x] Adversarial review of the plan diff before commit (Codex, gpt-6-astra). Ten findings. Fixed: memory store returned mutable internal references; `compareVersions` lost precision above 2^53 and could return `NaN`; a rule naming a prototype property (`toString`) threw `TypeError` instead of a schema issue; `required_paths` could descend through scalar-typed nodes; file store overwrote in place (now temp file plus rename); sparse arrays produced invalid canonical JSON. Accepted with reasons in Open questions: fixture routing not policy-sane; hash over parsed rubric; `validate` reports refinement issues only when the shape parses; symlink escape in the file store.

## Verification log

| Date | Command | Result |
| --- | --- | --- |
| 2026-09-19 | `pnpm format && pnpm lint` | pass, 33 files |
| 2026-09-19 | `pnpm typecheck` | pass |
| 2026-09-19 | `pnpm test` | pass, 108 tests in 8 files (after adversarial review fixes) |
| 2026-09-19 | `bash scripts/check-harness.sh` | harness ok |

## Open questions

- Whether `latestPublished` should also verify hashes on read for the in-memory store. Resolved: no, `put` verifies once. The file store verifies on every read because bytes on disk can change, and it also rejects a file whose declared `scheme` or `version` disagrees with its path.
- The fixture's routing table exercises every condition kind but is not policy-sane: `evidence_quality score_above 2` auto-approves before most eligibility Nouls are consulted. Plan 0003 resolver tests must author their own expected routes and not treat the fixture table as policy.
- `validate` collects every Zod issue, but Zod runs the structural refinements only when the base shape parses. A document missing `model_pin` and also carrying a bad rule reports only the missing field. Fixing this means running the refinements on a partial parse; deferred until a consumer needs it.
- The file store rejects `/`, `\\`, `.` and `..` segments but does not resolve symlinks. A scheme directory that is a symlink outside the root is followed. The file store targets local development and tests; a hostile store directory is out of scope until the registry service.
- The content hash is computed over the parsed rubric, after Zod defaults. Unknown top-level fields are stripped by the schema and so never enter the hash; this is intended, because code only ever sees the parsed document. A tool in another language (the Python sibling) must apply the same defaults before hashing, or hashes will not agree across implementations.
