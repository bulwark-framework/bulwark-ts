import { describe, expect, it } from "vitest";
import { createActivities } from "../../src/activities/index.js";
import { MemoryRubricStore } from "../../src/store/memory.js";
import { loadFixture } from "../../src/store/test-helpers.js";

describe.skipIf(!process.env.TYPESAFE_API_KEY)("TypeSafe live", () => {
  it("answers clear-cut disaster-grant questions at the pinned model", async () => {
    const store = new MemoryRubricStore();
    const fixture = await store.put(loadFixture());
    const activities = createActivities({ store });
    const { rubric } = await activities.resolveRubric({
      scheme: fixture.scheme,
      version: fixture.version,
    });
    const state = {
      applicant: { role: "sole owner of the business", identity_verified: true },
      business: {
        abn: "12345678901 (active continuously since registration)",
        abn_registered_at: "2020-01-01",
        location_lga: "Lismore",
        employee_count: 3,
        annual_turnover_aud: 300000,
      },
      event: { declaration_id: "AGRN-1234", declared_lgas: ["Lismore"], occurred_at: "2026-03-01" },
      damage: {
        description:
          "The declared flood directly damaged the shop floor. Floodwater entered on 2026-03-01; the floor required repair.",
        photograph_captions: [
          "Dated 2026-03-01: floodwater and damaged shop floor at the business premises.",
        ],
        claimed_cost_aud: 5000,
      },
      costs: { items: [{ description: "Repair of flood-damaged shop floor", amount_aud: 5000 }] },
      insurance: {
        policy_status: "No insurance policy held; none of the claimed items were insured.",
        claim_status: "No claim exists because there is no insurance.",
        settlement_aud: 0,
      },
      evidence: {
        documents: [
          "Itemised paid invoice INV-001 from Lismore Flooring, 2026-03-10: repair of flood-damaged shop floor at the business premises, AUD 5000. Receipt confirms payment in full.",
        ],
        invoice_captions: [
          "INV-001: labour AUD 3000 and flooring materials AUD 2000, total AUD 5000; covers all claimed costs.",
        ],
      },
      other_assistance: { grants_received: [] },
      case: { flags: [], claimed_amount_aud: 5000 },
      ...rubric.static_state,
    };
    // Every facet must pass the intake schema check before it reaches decide.
    for (const facet of Object.keys(state)) {
      if (facet in rubric.static_state) continue;
      await activities.intake({
        caseId: "live-1",
        facet,
        artefacts: { json: state[facet as keyof typeof state] },
        stateSchema: rubric.state_schema,
      });
    }
    const { answers, responseModel } = await activities.decide({ rubric, state });
    expect(responseModel.length).toBeGreaterThan(0);
    const area = answers.business_in_declared_area;
    const abn = answers.abn_active_before_event;
    const insurance = answers.insurance_overlap;
    const evidence = answers.evidence_quality;
    expect(area?.type).toBe("noul");
    expect(abn?.type).toBe("noul");
    expect(insurance?.type).toBe("choice");
    expect(evidence?.type).toBe("score");
    if (area?.type === "noul") expect(area.p).toBeGreaterThan(0.7);
    if (abn?.type === "noul") expect(abn.p).toBeGreaterThan(0.7);
    if (insurance?.type === "choice") expect(insurance.label).toBe("not_insured");
    if (evidence?.type === "score") expect(evidence.level).toBeGreaterThanOrEqual(2);
  }, 60000);
});
