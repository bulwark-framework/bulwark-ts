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

- [ ] `packages/core/src/rubric/hash.ts`: `canonicalJson`, `hash`, `stripVolatileFields`. Tests for criterion 1.
- [ ] `packages/core/src/rubric/errors.ts`: `BulwarkError` and the four subclasses with `name`, `details`. Tests that `name` survives `JSON.stringify` round trip.
- [ ] `packages/core/src/rubric/validate.ts`: wraps the 0001 Zod schema, collects all issues into `InvalidRubricError`. Tests for criterion 2.
- [ ] `packages/core/fixtures/disaster-grant/rubric.json` plus `packages/core/fixtures/disaster-grant/README.md` describing each question and rule. Tests for criterion 7.
- [ ] `packages/core/src/store/types.ts`: `RubricStore`, `RubricRef` (`{ scheme, version }` or `{ scheme, latest: 'published' }`), `compareVersions`. Tests for the ordering decision.
- [ ] `packages/core/src/store/memory.ts`: in-memory store. Tests for criteria 4 and 6.
- [ ] `packages/core/src/store/file.ts`: file store. Tests for criteria 4, 5, 6 with a fixture directory.
- [ ] Export from `rubric/index.ts` and `store/index.ts`. Update `packages/core/package.json` `exports`.
- [ ] `ARCHITECTURE.md`: Rubric store row to implemented with entry point; Rubric row gains hash and validate.
- [ ] `docs/QUALITY_SCORE.md`: rubric schema validation row updated with date and command.
- [ ] Adversarial review of the plan diff before commit (see user-level guidelines).

## Verification log

| Date | Command | Result |
| --- | --- | --- |

## Open questions

- Whether `latestPublished` should also verify hashes on read for the in-memory store. Default: no, `put` verifies once.
