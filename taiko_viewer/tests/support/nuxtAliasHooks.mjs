// Node module resolution hook so the test suite can load the real Nuxt aliases
// (`~/...`) used by `utils/annualSummary.ts`. Without it the module can only be
// checked through a hand-written replica, which is exactly how a silent
// `calendarParts(new Date())` regression slipped through once already.
import { access } from "node:fs/promises";
import { resolve as resolvePath } from "node:path";
import { pathToFileURL } from "node:url";

// This hook lives in `tests/support`, so the viewer root is two levels up.
const webRoot = resolvePath(import.meta.dirname, "..", "..");

export async function resolve(specifier, context, nextResolve) {
  const isAlias = specifier === "~" || specifier.startsWith("~/");
  if (isAlias) {
    const base = resolvePath(webRoot, specifier === "~" ? "" : specifier.slice(2));
    for (const candidate of [base, `${base}.ts`, `${base}/index.ts`]) {
      try {
        await access(candidate);
        return { url: pathToFileURL(candidate).href, shortCircuit: true };
      } catch {
        // try the next candidate
      }
    }
  }
  return nextResolve(specifier, context);
}
