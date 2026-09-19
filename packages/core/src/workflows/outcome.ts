import { workflowInfo } from "@temporalio/workflow";
import type { AssessmentResult, OutcomeRecord } from "./types.js";
export function buildOutcomeRecord(result: AssessmentResult, decidedBy: string): OutcomeRecord {
  const { workflowId, runId } = workflowInfo();
  // Temporal patches Date.now in the workflow sandbox for deterministic replay.
  const decidedAt = new Date(Date.now()).toISOString();
  return {
    caseId: result.caseId,
    scheme: result.pinned.rubric.scheme,
    version: result.pinned.version,
    contentHash: result.pinned.contentHash,
    state: result.state,
    answers: result.answers,
    ...result.resolution,
    model: result.model,
    usage: result.usage,
    decidedBy,
    decidedAt,
    workflowId,
    runId,
  };
}
