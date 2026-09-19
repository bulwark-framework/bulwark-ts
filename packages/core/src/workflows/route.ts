import type { Resolution } from "../resolver/resolve.js";
export function isAutomatic(
  resolution: Resolution,
): resolution is Resolution & { route: "auto_approve" | "auto_decline" } {
  return (
    resolution.uncertain.length === 0 &&
    (resolution.route === "auto_approve" || resolution.route === "auto_decline")
  );
}
