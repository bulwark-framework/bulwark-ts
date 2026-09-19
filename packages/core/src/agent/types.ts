/**
 * Placeholder for the agent runner contract.
 *
 * Concrete adapters live in the `@bulwark-framework/activities-claude` and
 * `@bulwark-framework/activities-openai` packages, decided 2026-09-19.
 */
export interface AgentRunner {
  readonly provider: string;
}
