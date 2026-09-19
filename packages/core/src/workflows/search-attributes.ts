import type { SearchAttributes } from "@temporalio/workflow";
import type { Pinned } from "./types.js";
import { BulwarkSearchAttributes } from "./types.js";
/** upsertSearchAttributes accepts this array-valued keyword payload. */
export function bulwarkSearchAttributes(pinned: Pinned, route: string): SearchAttributes {
  return {
    [BulwarkSearchAttributes.scheme]: [pinned.rubric.scheme],
    [BulwarkSearchAttributes.rubricVersion]: [pinned.version],
    [BulwarkSearchAttributes.route]: [route],
  };
}
