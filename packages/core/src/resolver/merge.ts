function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function copy(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(copy);
  if (isPlainObject(value)) return mergeObject({}, value);
  return value;
}

function mergeObject(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  for (const [key, value] of Object.entries(source)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
    const previous = target[key];
    target[key] = isPlainObject(value)
      ? mergeObject(isPlainObject(previous) ? previous : {}, value)
      : copy(value);
  }
  return target;
}

/** Facets are applied in object enumeration order; static state is applied last. */
export function merge(
  fragments: Record<string, unknown>,
  staticState: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const fragment of Object.values(fragments)) {
    if (isPlainObject(fragment)) mergeObject(result, fragment);
  }
  return mergeObject(result, staticState);
}
