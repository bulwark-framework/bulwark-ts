import { z } from "zod";
import { defineRubric } from "../../src/authoring/index.js";
import type { Question } from "../../src/rubric/schema.js";

export const questions = {
  business_in_declared_area: {
    type: "noul",
    instructions:
      "Is the business's primary place of operation in a local government area named in `event.declared_lgas`, as `policy.declared_area_s11` requires?",
    criteria: {
      true: "The business location is one of the declared areas for this event.",
      false:
        "The business location is outside every declared area, or no declaration covers the event.",
    },
    cites: ["s11(1)", "s11(2)(a)"],
    required_paths: ["business.location_lga", "event.declared_lgas", "policy.declared_area_s11"],
  },
  applicant_is_owner: {
    type: "noul",
    instructions:
      "Does `applicant.role` show that the applicant owns the business, or holds written authority to apply for the owner, as `policy.eligible_applicant_s12` requires?",
    cites: ["s12(1)"],
    required_paths: ["applicant.role", "policy.eligible_applicant_s12"],
  },
  business_is_small: {
    type: "noul",
    instructions:
      "Do `business.employee_count` and `business.annual_turnover_aud` meet the small business test in `policy.small_business_s13`?",
    cites: ["s13(1)(a)", "s13(1)(b)"],
    required_paths: [
      "business.employee_count",
      "business.annual_turnover_aud",
      "policy.small_business_s13",
    ],
  },
  abn_active_before_event: {
    type: "noul",
    instructions:
      "Was the ABN in `business.abn` active before `event.occurred_at`, as `policy.registration_s14` requires?",
    cites: ["s14(2)"],
    required_paths: ["business.abn_registered_at", "event.occurred_at", "policy.registration_s14"],
    criteria: {
      true: "The ABN was registered and active before the day the event started.",
      false: "The ABN was registered on or after that day, or was not active.",
    },
  },
  direct_damage_established: {
    type: "noul",
    instructions:
      "Does `damage.description` describe damage the event caused directly, and not lost trade, under `policy.direct_damage_s15`?",
    cites: ["s15(1)", "s15(3)"],
    required_paths: [
      "damage.description",
      "damage.photograph_captions",
      "policy.direct_damage_s15",
    ],
  },
  costs_are_eligible: {
    type: "noul",
    instructions:
      "Is every item in `costs.items` an eligible cost under `policy.eligible_costs_s16`?",
    cites: ["s16(1)", "s16(4)"],
    required_paths: ["costs.items", "policy.eligible_costs_s16"],
  },
  no_duplicate_assistance: {
    type: "noul",
    instructions:
      "Is every claimed cost free of another government grant for the same event, listed in `other_assistance.grants_received`, under `policy.no_duplication_s21`?",
    cites: ["s21(1)"],
    required_paths: ["other_assistance.grants_received", "policy.no_duplication_s21"],
  },
  insurance_overlap: {
    type: "choice",
    instructions:
      "Which insurance position applies to the claimed costs, given `insurance.policy_status`, `insurance.claim_status`, and `insurance.settlement_aud`? Use `policy.insurance_offset_s18`.",
    criteria: {
      not_insured: "The business held no policy that covers the claimed items.",
      insured_no_claim: "A policy covers the items but the business has made no claim.",
      claim_pending: "A claim is open and the insurer has not decided it.",
      partially_settled: "The insurer has paid part of the claimed items.",
      fully_settled: "The insurer has paid, or will pay, every claimed item in full.",
      none_of_the_above: "The position does not fit any option above.",
    },
    no_match: "none_of_the_above",
    cites: ["s18(1)", "s18(2)"],
    required_paths: [
      "insurance.policy_status",
      "insurance.claim_status",
      "policy.insurance_offset_s18",
    ],
  },
  evidence_quality: {
    type: "score",
    instructions:
      "How well do `evidence.documents` and `evidence.invoice_captions` substantiate the claimed costs? Use the levels in `policy.evidence_guideline_4_2`.",
    criteria: [
      "No evidence of the claimed costs.",
      "The applicant's own statement only.",
      "Third-party quotes or photographs, but no invoices.",
      "Itemised invoices or receipts that cover the claimed costs.",
    ],
    cites: ["Guideline 4.2"],
    required_paths: [
      "evidence.documents",
      "evidence.invoice_captions",
      "policy.evidence_guideline_4_2",
    ],
  },
  needs_senior: {
    type: "noul",
    instructions:
      "Do `case.flags` and `case.claimed_amount_aud` show a case that a senior assessor must see under `policy.escalation_guideline_6_1`?",
    cites: ["Guideline 6.1"],
    required_paths: ["case.flags", "case.claimed_amount_aud", "policy.escalation_guideline_6_1"],
  },
} satisfies Record<string, Question>;

export const input = {
  scheme: "disaster-grant",
  version: "2026.9.1",
  model_pin: "jev-1.13.0",
  state: z.object({
    applicant: z.object({ role: z.string(), identity_verified: z.boolean() }),
    business: z.object({
      abn: z.string(),
      abn_registered_at: z.string(),
      location_lga: z.string(),
      employee_count: z.number(),
      annual_turnover_aud: z.number(),
    }),
    event: z.object({
      declaration_id: z.string(),
      declared_lgas: z.array(z.string()),
      occurred_at: z.string(),
    }),
    damage: z.object({
      description: z.string(),
      photograph_captions: z.array(z.string()),
      claimed_cost_aud: z.number(),
    }),
    costs: z.object({
      items: z.array(z.object({ description: z.string(), amount_aud: z.number() })),
    }),
    insurance: z.object({
      policy_status: z.string(),
      claim_status: z.string(),
      settlement_aud: z.number(),
    }),
    evidence: z.object({ documents: z.array(z.string()), invoice_captions: z.array(z.string()) }),
    other_assistance: z.object({ grants_received: z.array(z.string()) }),
    case: z.object({ flags: z.array(z.string()), claimed_amount_aud: z.number() }),
  }),
  static: {
    policy: {
      declared_area_s11:
        "A business is in a declared area if its primary place of operation is in a local government area named in the disaster declaration for the event.",
      eligible_applicant_s12:
        "An applicant is eligible if the applicant owns the business, or holds written authority from the owner to apply on the owner's behalf.",
      small_business_s13:
        "A small business employs fewer than twenty full-time equivalent staff and has an annual turnover under ten million dollars.",
      registration_s14:
        "The business must have held an active ABN before the day the disaster event started.",
      direct_damage_s15:
        "Damage is direct if the disaster event caused it. Loss of trade, loss of custom, and a fall in demand are not direct damage.",
      eligible_costs_s16:
        "Eligible costs are clean-up, disposal of damaged stock, repair of premises, and replacement of damaged plant. Wages, rent, and insurance excesses are not eligible.",
      insurance_offset_s18:
        "The grant is reduced by the amount an insurer has paid or will pay for the same item. A pending claim must be resolved before payment.",
      no_duplication_s21:
        "The grant is not payable for a cost already met by another government grant for the same event.",
      evidence_guideline_4_2:
        "Evidence levels: none; the applicant's own statement only; third-party quotes or photographs; itemised invoices or receipts that cover the claimed costs.",
      escalation_guideline_6_1:
        "A senior assessor must see a case that shows a conflict of interest, a repeat claim for the same premises, or an amount above the delegate's limit.",
    },
  },
  questions,
  thresholds: { lo: 0.3, hi: 0.7, conf_floor: 0.6 },
  default: "assessor" as const,
};

export default defineRubric({
  ...input,
  routing: (q) => [
    q.business_in_declared_area
      .band("no")
      .route("auto_decline", "the business is outside every declared area (s11)"),
    q.direct_damage_established
      .band("no")
      .route("auto_decline", "no direct damage from the event (s15)"),
    q.needs_senior
      .band("uncertain")
      .route("assessor", "escalation indicators are unclear (Guideline 6.1)"),
    q.needs_senior
      .band("yes")
      .route("assessor", "a senior assessor must see this case (Guideline 6.1)"),
    q.insurance_overlap
      .equals("fully_settled")
      .route("auto_decline", "the insurer covers every claimed item in full (s18)"),
    q.insurance_overlap
      .isNoMatch()
      .route("assessor", "the insurance position does not fit any option"),
    q.insurance_overlap
      .confidenceBelow()
      .route("assessor", "low confidence on the insurance position"),
    q.evidence_quality
      .scoreBelow(2)
      .route("request_info", "evidence does not substantiate the claimed costs (Guideline 4.2)"),
    q.evidence_quality
      .scoreAbove(2)
      .route("auto_approve", "itemised invoices cover the claimed costs (Guideline 4.2)"),
  ],
});
