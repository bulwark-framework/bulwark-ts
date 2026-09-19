/**
 * The rubric store contract and the version ordering every implementation
 * shares.
 *
 * A store holds published and unpublished rubric versions for one or more
 * schemes. `put` is the only place a document is validated and its content
 * hash checked for an in-memory implementation; a file store re-validates on
 * read because the bytes on disk can change between writes.
 */
import type { Rubric } from "../rubric/index.js";

/**
 * How a caller names a rubric: an exact version, or "whatever is published
 * now". Invariant 3 means a case run resolves this once and records the
 * concrete version it got.
 */
export type RubricRef =
  | { scheme: string; version: string }
  | { scheme: string; latest: "published" };

export interface RubricStore {
  /**
   * @throws RubricNotFoundError when the scheme or version is unknown.
   * @throws HashMismatchError when the stored bytes no longer match
   * `content_hash` (implementations that re-read bytes).
   */
  get(scheme: string, version: string): Promise<Rubric>;

  /**
   * The highest `published` version of `scheme` by {@link compareVersions}.
   * `draft`, `candidate`, and `deprecated` versions are ignored.
   *
   * @throws RubricNotFoundError with version `latest-published` when the
   * scheme is unknown or has no published version.
   */
  latestPublished(scheme: string): Promise<Rubric>;

  /**
   * Validates `rubric`, checks its content hash, stores it, and returns the
   * parsed document. Storing the same scheme and version again overwrites.
   *
   * @throws InvalidRubricError when the document does not validate.
   * @throws HashMismatchError when `content_hash` does not match the content.
   */
  put(rubric: unknown): Promise<Rubric>;
}

const NUMERIC = /^\d+$/;

/**
 * Orders two version strings segment-wise on `.`.
 *
 * Two numeric segments compare numerically, so `2026.9.10` is above
 * `2026.9.2`. A numeric segment sorts before a non-numeric one, so
 * `1.0.0` is below `1.0.0-rc`. Two non-numeric segments compare as strings.
 * When every shared segment is equal the shorter version is the smaller one,
 * so `1.0` is below `1.0.0`.
 *
 * @returns a negative number when `a` is below `b`, 0 when equal, a positive
 * number when `a` is above `b`.
 */
export function compareVersions(a: string, b: string): number {
  const left = a.split(".");
  const right = b.split(".");
  const shared = Math.min(left.length, right.length);
  for (let i = 0; i < shared; i += 1) {
    const x = left[i] as string;
    const y = right[i] as string;
    const xNumeric = NUMERIC.test(x);
    const yNumeric = NUMERIC.test(y);
    if (xNumeric && yNumeric) {
      // BigInt keeps segments beyond 2^53 exact and never yields NaN.
      const bx = BigInt(x);
      const by = BigInt(y);
      if (bx !== by) return bx < by ? -1 : 1;
      continue;
    }
    if (xNumeric !== yNumeric) return xNumeric ? -1 : 1;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return Math.sign(left.length - right.length);
}

/** Dispatches a {@link RubricRef} to `get` or `latestPublished`. */
export function resolveRef(store: RubricStore, ref: RubricRef): Promise<Rubric> {
  if ("latest" in ref) return store.latestPublished(ref.scheme);
  return store.get(ref.scheme, ref.version);
}
