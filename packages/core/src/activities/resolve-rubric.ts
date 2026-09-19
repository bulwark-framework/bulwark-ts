import { validateWithHash } from "../rubric/validate.js";
import { type RubricStore, resolveRef } from "../store/types.js";
import { wrapBulwarkErrors } from "./failures.js";
import type { Activities } from "./types.js";

export function resolveRubric(store: RubricStore): Activities["resolveRubric"] {
  return (ref) =>
    wrapBulwarkErrors(async () => {
      const rubric = validateWithHash(await resolveRef(store, ref));
      return { rubric, resolvedVersion: rubric.version, contentHash: rubric.content_hash };
    });
}
