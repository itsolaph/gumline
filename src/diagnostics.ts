import type { Diagnostic } from "@hyper-elements/react";

/** Groups repeated diagnostics (a label drawn 65 times warns 65 times) into one line each, with a count and the first path. */
export function summarise(diagnostics: Diagnostic[], minSeverity: "warning" | "error" = "warning"): string[] {
  const groups = new Map<string, { d: Diagnostic; n: number }>();
  for (const d of diagnostics) {
    if (d.severity === "info") continue;
    if (minSeverity === "error" && d.severity !== "error") continue;
    const key = `${d.severity} ${d.code} ${d.message.replace(/\d+(\.\d+)?/g, "#")}`;
    const hit = groups.get(key);
    if (hit) hit.n++;
    else groups.set(key, { d, n: 1 });
  }
  return [...groups.values()].map(({ d, n }) => `${d.severity} ${d.code} x${n}: ${d.message} (first at ${d.path})`);
}
