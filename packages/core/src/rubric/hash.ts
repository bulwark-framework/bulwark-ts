/**
 * Canonical JSON and the rubric content hash.
 *
 * The hash covers everything except the fields that change when a human
 * approves a rubric, so approval never changes the identity of the content.
 */
import { createHash } from "node:crypto";

/**
 * Fields removed before hashing because they change after the content is
 * fixed. `content_hash` is removed too: a hash cannot include itself.
 */
export const VOLATILE_FIELDS = [
  "status",
  "provenance.approved_by",
  "provenance.approved_at",
] as const;

/**
 * Deep-clones `rubric` and removes `status`, `content_hash`,
 * `provenance.approved_by`, and `provenance.approved_at`. The input is not
 * mutated and every other field is kept.
 */
export function stripVolatileFields<T extends Record<string, unknown>>(
  rubric: T,
): Record<string, unknown> {
  const copy = structuredClone(rubric) as Record<string, unknown>;
  delete copy.status;
  delete copy.content_hash;
  const provenance = copy.provenance;
  if (provenance !== null && typeof provenance === "object" && !Array.isArray(provenance)) {
    const p = provenance as Record<string, unknown>;
    delete p.approved_by;
    delete p.approved_at;
  }
  return copy;
}

/**
 * Serialises `value` with object keys sorted recursively, no whitespace, and
 * arrays in their given order. Numbers and strings format exactly as
 * `JSON.stringify` formats them, and `undefined` object values are omitted.
 */
export function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) {
    // `Array.from` visits holes too, so a sparse array hashes like JSON.stringify prints it.
    return `[${Array.from(value, (item) => (item === undefined ? "null" : canonicalJson(item))).join(",")}]`;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const parts: string[] = [];
    for (const key of Object.keys(record).sort()) {
      const entry = record[key];
      if (entry === undefined) continue;
      parts.push(`${JSON.stringify(key)}:${canonicalJson(entry)}`);
    }
    return `{${parts.join(",")}}`;
  }
  if (value === undefined) return "null";
  return JSON.stringify(value) ?? "null";
}

/**
 * SHA-256 over the canonical JSON of the rubric with the volatile fields
 * removed, formatted as `sha256:<64 lowercase hex>`.
 *
 * Callers should hash the *parsed* rubric, after the schema has applied its
 * defaults (`cites`, `required_paths`, `no_match`, `static_state`,
 * `provenance`). The hash is then the same whether or not the author wrote
 * those defaults out by hand.
 */
export function hash(rubric: Record<string, unknown>): string {
  const digest = createHash("sha256").update(canonicalJson(stripVolatileFields(rubric)), "utf8");
  return `sha256:${digest.digest("hex")}`;
}
