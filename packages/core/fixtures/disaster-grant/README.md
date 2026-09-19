# disaster-grant fixture

`rubric.json` is the canonical fixture rubric for plan 0002. It is the worked
example from [assessment-graph.md](../../../../docs/design-docs/assessment-graph.md):
a disaster recovery grant for a small business.

The rubric has ten questions. Eight are Nouls, one is a Choice, and one is a
Score. It uses every routing condition kind, so tests can cover the resolver
later without a second fixture.

The scheme, the policy text in `static_state`, and every section citation are
invented for this fixture. They do not name real law.

- Scheme: `disaster-grant`
- Version: `2026.9.1`
- Status: `published`
- Model pin: `jev-1.13.0`
- Content hash: `sha256:c9371f59ee310d0267b4a84825a89e482655762c3a9d23ad873f4a801d41139c`

The hash covers the rubric after the schema applies its defaults. It does not
cover `status`, `provenance.approved_by`, `provenance.approved_at`, or
`content_hash` itself. If you change the file, recompute the hash with
`hash()` from `@bulwark-framework/core/rubric` and write the new value back.

## Questions

### business_in_declared_area

- Type: Noul
- Asks: is the primary place of operation in a local government area named in the disaster declaration?
- Cites: s11(1), s11(2)(a)
- Needs: `business.location_lga`, `event.declared_lgas`, `policy.declared_area_s11`

### applicant_is_owner

- Type: Noul
- Asks: does the applicant own the business, or hold written authority to apply for the owner?
- Cites: s12(1)
- Needs: `applicant.role`, `policy.eligible_applicant_s12`

### business_is_small

- Type: Noul
- Asks: does the business meet the staff and turnover limits for a small business?
- Cites: s13(1)(a), s13(1)(b)
- Needs: `business.employee_count`, `business.annual_turnover_aud`, `policy.small_business_s13`

### abn_active_before_event

- Type: Noul
- Asks: was the ABN active before the day the event started?
- Cites: s14(2)
- Needs: `business.abn_registered_at`, `event.occurred_at`, `policy.registration_s14`

### direct_damage_established

- Type: Noul
- Asks: did the event cause the damage directly? Lost trade is not direct damage.
- Cites: s15(1), s15(3)
- Needs: `damage.description`, `damage.photograph_captions`, `policy.direct_damage_s15`

### costs_are_eligible

- Type: Noul
- Asks: is every claimed cost an eligible cost?
- Cites: s16(1), s16(4)
- Needs: `costs.items`, `policy.eligible_costs_s16`

### no_duplicate_assistance

- Type: Noul
- Asks: has another government grant for the same event already met a claimed cost?
- Cites: s21(1)
- Needs: `other_assistance.grants_received`, `policy.no_duplication_s21`

### insurance_overlap

- Type: Choice
- Asks: which insurance position applies to the claimed costs?
- Labels: `not_insured`, `insured_no_claim`, `claim_pending`, `partially_settled`,
  `fully_settled`, and the no-match label `none_of_the_above`.
- Cites: s18(1), s18(2)
- Needs: `insurance.policy_status`, `insurance.claim_status`, `policy.insurance_offset_s18`

The rule branches on which position applies, so this is a Choice and not a
Noul. The quantum arithmetic that follows stays in code.

### evidence_quality

- Type: Score, four levels: no evidence; the applicant's own statement; quotes
  or photographs; itemised invoices that cover the claimed costs.
- Asks: how well does the evidence substantiate the claimed costs?
- Cites: Guideline 4.2
- Needs: `evidence.documents`, `evidence.invoice_captions`, `policy.evidence_guideline_4_2`

### needs_senior

- Type: Noul
- Asks: does the case show a conflict of interest, a repeat claim, or an amount
  above the delegate's limit?
- Cites: Guideline 6.1
- Needs: `case.flags`, `case.claimed_amount_aud`, `policy.escalation_guideline_6_1`

## Routing

Rules are evaluated in order. The first rule that matches sets the route.
`routing.default` is `assessor`: a case that matches no rule goes to a person.

| Index | Condition | Route | Reason |
| --- | --- | --- | --- |
| 0 | `business_in_declared_area` band `no` | `auto_decline` | The business is outside every declared area (s11). |
| 1 | `direct_damage_established` band `no` | `auto_decline` | No direct damage from the event (s15). |
| 2 | `needs_senior` band `uncertain` | `assessor` | Escalation indicators are unclear (Guideline 6.1). |
| 3 | `needs_senior` band `yes` | `assessor` | A senior assessor must see this case (Guideline 6.1). |
| 4 | `insurance_overlap` equals `fully_settled` | `auto_decline` | The insurer covers every claimed item in full (s18). |
| 5 | `insurance_overlap` is no match | `assessor` | The insurance position does not fit any option. |
| 6 | `insurance_overlap` confidence below the floor | `assessor` | Low confidence on the insurance position. |
| 7 | `evidence_quality` score below level 2 | `request_info` | Evidence does not substantiate the claimed costs (Guideline 4.2). |
| 8 | `evidence_quality` score above level 2 | `auto_approve` | Itemised invoices cover the claimed costs (Guideline 4.2). |

Thresholds: `lo` 0.3, `hi` 0.7, `conf_floor` 0.6. A Noul answer below `lo` is
`no`, above `hi` is `yes`, and between them is `uncertain`.
`confidence_below: true` in rule 6 means "below `conf_floor`".
