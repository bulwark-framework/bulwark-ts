# Resolver answer fixtures

Each file is one `Answers` object over all ten questions of `../rubric.json`.
Every set that expects an automatic or evidence route sets `needs_senior` low
so that the senior-review rule does not intervene.

| File | Route | Rule index | Fires on |
| --- | --- | --- | --- |
| `auto-approve.json` | `auto_approve` | 8 | `evidence_quality` `score_above: 2` |
| `auto-decline.json` | `auto_decline` | 0 | `business_in_declared_area` `band: no` |
| `uncertain-needs-senior.json` | `assessor` | 2 | `needs_senior` `band: uncertain` (p 0.46) |
| `senior-required.json` | `assessor` | 3 | `needs_senior` `band: yes` (p 0.95) |
| `no-match-insurance.json` | `assessor` | 5 | `insurance_overlap` `is_no_match` |
| `low-evidence.json` | `request_info` | 7 | `evidence_quality` `score_below: 2` |
