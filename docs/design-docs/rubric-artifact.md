# Rubric artifact

The one contract both planes share. Status: encoded. The Zod source at [`packages/core/src/rubric/schema.ts`](../../packages/core/src/rubric/schema.ts) is canonical for field names and structural rules; the example below is loaded by its tests and must keep validating.

## Shape

```json
{
  "scheme": "ccs-eligibility",
  "version": "2026.09.3",
  "status": "published",
  "content_hash": "sha256:9f2c1b0e7a4d5c6f8e9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e",
  "supersedes": "2026.08.1",

  "state_schema": { "$schema": "…", "properties": { "applicant": {}, "child": {}, "activity": {}, "income": {} } },

  "static_state": {
    "policy": {
      "eligibility_s85BA": "An individual is eligible for CCS for a session of care if…",
      "activity_test_s85CA": "The activity test result is determined by the recognised activity…"
    }
  },

  "questions": {
    "residency_met": {
      "type": "noul",
      "instructions": "Does `applicant.residency` satisfy the residency requirement in `policy.eligibility_s85BA`?",
      "cites": ["s85BA(1)(b)"],
      "required_paths": ["applicant.residency"]
    },
    "activity_step": {
      "type": "choice",
      "instructions": "Which activity-test step applies given `activity.hours_per_fortnight` and `activity.exemptions`?",
      "criteria": { "step_0": "…", "step_1": "…", "step_2": "…", "step_3": "…", "none_of_the_above": "…" },
      "cites": ["s85CA", "Sch 2"]
    },
    "evidence_quality": {
      "type": "score",
      "instructions": "How well does `activity.evidence` substantiate the claimed hours?",
      "criteria": ["no evidence", "self-declaration only", "employer letter or payslips", "employer letter and payslips covering the period"],
      "cites": ["Guideline 4.2"]
    }
  },

  "routing": {
    "rules": [
      { "when": { "question": "residency_met", "band": "no" }, "route": "auto_decline", "reason": "residency requirement not met (s85BA)" },
      { "when": { "question": "residency_met", "band": "uncertain" }, "route": "assessor", "reason": "residency uncertain" },
      { "when": { "question": "activity_step", "is_no_match": true }, "route": "assessor", "reason": "activity step could not be determined" },
      { "when": { "question": "activity_step", "confidence_below": 0.60 }, "route": "assessor", "reason": "low confidence on activity step" },
      { "when": { "question": "evidence_quality", "score_below": 1.5 }, "route": "request_info", "reason": "evidence insufficient (Guideline 4.2)" }
    ],
    "default": "auto_approve"
  },

  "thresholds": { "lo": 0.30, "hi": 0.70, "conf_floor": 0.60 },
  "model_pin": "jev-1.13.0",

  "provenance": {
    "corpus_hashes": { "A New Tax System (Family Assistance) Act 1999": "sha256:…" },
    "compile_workflow_id": "compile-ccs-eligibility-2026-09-12T03:10Z",
    "golden_eval_id": "eval-8821",
    "golden_eval_result": "pass",
    "corpus_index_ref": "idx-sha256:4b1e…",
    "researcher_model": "claude-opus-5",
    "contextualiser_model": "claude-sonnet-5",
    "approved_by": "policy.owner@example.gov",
    "approved_at": "2026-09-14T22:41:00Z",
    "origin_of_questions": { "needs_assessor": "promoted from case proposal CLM-11902" }
  }
}
```

Section references are illustrative, not verified citations.

## Rules

- `status` is one of `draft`, `candidate`, `published`, `deprecated`. A `published` rubric must carry `provenance.golden_eval_result: "pass"`, `provenance.approved_by`, and `provenance.approved_at` (invariant 4). The schema enforces this.
- `content_hash` is `sha256:` followed by 64 lowercase hex characters. It covers everything except `status` and `provenance.approved_*`, so approval does not change the hash. The example's digest is illustrative; plan 0002 verifies real ones.
- `questions.*.type` maps directly onto TypeSafe primitives. `criteria` shapes follow `@typesafe-ai/sdk` types: Noul takes optional `{ true, false }`, Choice takes a label-to-description map, Score takes an ordered array of at least two levels. A description may be `null` to leave a label undescribed. `state_schema` accepts boolean subschemas and tuple `items`.
- Every Choice must include a no-match label. The optional `no_match` field on a Choice names it; it defaults to `none_of_the_above`. The schema enforces that the label exists in `criteria`.
- `required_paths` are dot-and-index paths into `state_schema`, or into `static_state`. The schema resolves each one. A key missing from a declared `properties` map fails unless `additionalProperties` is explicitly permissive.
- `routing.rules` is an ordered list evaluated first-match. Each rule has one condition on one question: `band` (`no`, `uncertain`, `yes`) for a Noul; `equals` or `is_no_match` for a Choice; `confidence_below` for a Choice or Score; `score_below` or `score_above` for a Score. `routing.default` applies when no rule matches and may not be `auto_decline`. Validation rejects a rule whose question id does not exist or whose condition type does not fit the question type.
- `thresholds` keys `lo`, `hi`, and `conf_floor` are required. `band` conditions use `lo` and `hi`; `is_no_match` uses `conf_floor`, and `confidence_below: true` means "below `conf_floor`" where a number is an explicit floor. `score_below` and `score_above` levels must lie within `0..criteria.length - 1`.
- `model_pin` is an exact model id, never an alias.
- `provenance.corpus_index_ref`, `provenance.researcher_model`, and `provenance.contextualiser_model` are optional. A compiled rubric records them; a hand-authored rubric omits them. They are part of the content hash.

## Golden case shape

```json
{
  "id": "gold-ccs-0147",
  "source": "de-identified determination 2025-11, internal review upheld",
  "state": {},
  "expected": {
    "route": "auto_approve",
    "answers": { "residency_met": "yes", "activity_step": "step_2" },
    "must_be_clear": ["residency_met"]
  },
  "tags": ["activity-test", "borderline"]
}
```
