/**
 * Typed error hierarchy shared by every Bulwark package.
 *
 * Every class sets `name` to a stable string literal so the name survives a
 * `JSON.stringify` round trip and any minification. Temporal
 * `ApplicationFailure` wrapping happens in activities, not here, so these
 * classes stay usable outside a workflow worker.
 */

/** One validation failure: a dotted path into the document and a message. */
export interface RubricIssue {
  path: string;
  message: string;
}

/** Shape produced by `BulwarkError.toJSON`. */
export interface BulwarkErrorJson {
  name: string;
  message: string;
  details: Record<string, unknown>;
}

export class BulwarkError extends Error {
  readonly details: Record<string, unknown>;

  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "BulwarkError";
    this.details = details;
  }

  toJSON(): BulwarkErrorJson {
    return { name: this.name, message: this.message, details: this.details };
  }
}

/** A document did not satisfy the rubric schema. Carries every issue found. */
export class InvalidRubricError extends BulwarkError {
  constructor(issues: RubricIssue[], message?: string) {
    super(message ?? `rubric is invalid: ${issues.length} issue(s)`, { issues });
    this.name = "InvalidRubricError";
  }

  get issues(): RubricIssue[] {
    return this.details.issues as RubricIssue[];
  }
}

/** No rubric exists for the requested scheme and version. */
export class RubricNotFoundError extends BulwarkError {
  constructor(scheme: string, version: string | "latest-published") {
    super(`no rubric for scheme "${scheme}" version "${version}"`, { scheme, version });
    this.name = "RubricNotFoundError";
  }
}

/** A rubric's `content_hash` does not match its content. */
export class HashMismatchError extends BulwarkError {
  constructor(scheme: string, version: string, expected: string, actual: string) {
    super(
      `content hash mismatch for "${scheme}" version "${version}": expected ${expected}, got ${actual}`,
      { scheme, version, expected, actual },
    );
    this.name = "HashMismatchError";
  }
}

/** Intake output did not conform to the rubric's `state_schema`. */
export class IntakeSchemaViolationError extends BulwarkError {
  constructor(issues: RubricIssue[], message?: string) {
    super(message ?? `intake state is invalid: ${issues.length} issue(s)`, { issues });
    this.name = "IntakeSchemaViolationError";
  }

  get issues(): RubricIssue[] {
    return this.details.issues as RubricIssue[];
  }
}
