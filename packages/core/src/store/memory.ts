/**
 * In-memory rubric store, for tests and for a worker that loads its rubrics
 * once at start-up.
 *
 * Per the plan's open question, `put` verifies the content hash once and reads
 * do not verify again: nothing can change the stored object between the two.
 */
import { type Rubric, RubricNotFoundError, validateWithHash } from "../rubric/index.js";
import { compareVersions, type RubricStore } from "./types.js";

export class MemoryRubricStore implements RubricStore {
  /** scheme -> version -> rubric. */
  readonly #schemes = new Map<string, Map<string, Rubric>>();

  /**
   * Seeds the store. Each entry is validated and hash-checked exactly as
   * `put` would, synchronously, so a bad seed fails at construction.
   *
   * @throws InvalidRubricError, HashMismatchError
   */
  constructor(seed: Iterable<unknown> = []) {
    for (const candidate of seed) this.#insert(validateWithHash(candidate));
  }

  #insert(rubric: Rubric): void {
    let versions = this.#schemes.get(rubric.scheme);
    if (versions === undefined) {
      versions = new Map<string, Rubric>();
      this.#schemes.set(rubric.scheme, versions);
    }
    // Store a private copy: a caller mutating what it passed in or got back
    // must not change the hash-checked document.
    versions.set(rubric.version, structuredClone(rubric));
  }

  // Every method is `async` so a validation failure surfaces as a rejected
  // promise, never as a synchronous throw from a `Promise`-returning call.
  async get(scheme: string, version: string): Promise<Rubric> {
    const found = this.#schemes.get(scheme)?.get(version);
    if (found === undefined) throw new RubricNotFoundError(scheme, version);
    return structuredClone(found);
  }

  async latestPublished(scheme: string): Promise<Rubric> {
    const published = [...(this.#schemes.get(scheme)?.values() ?? [])].filter(
      (rubric) => rubric.status === "published",
    );
    published.sort((a, b) => compareVersions(a.version, b.version));
    const highest = published.at(-1);
    if (highest === undefined) throw new RubricNotFoundError(scheme, "latest-published");
    return structuredClone(highest);
  }

  async put(rubric: unknown): Promise<Rubric> {
    const parsed = validateWithHash(rubric);
    this.#insert(parsed);
    return parsed;
  }
}
