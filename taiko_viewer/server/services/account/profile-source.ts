import type { BindingSummary } from "../../internal/account/shared";
import { extractUserdataCurrentTitle } from "../../internal/account/shared";
import { getDomainScoreReader } from "../taiko-domain/read.ts";
import { scorePublication } from "../taiko-domain/publication.ts";
import { PublicationUnavailableError } from "../../infrastructure/taiko-publication/client.ts";

/** Optional title only: missing source keeps the verified public title. A
 * managed corrupt source remains an explicit failure, never a stale fallback.
 */
export async function enrichAuthorizedCurrentTitle(binding: BindingSummary) {
  let title = binding.verifiedTitle;
  try {
    const { current } = await getDomainScoreReader().readCurrent(binding.taikoId);
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      if (scorePublication(binding.taikoId)) throw new PublicationUnavailableError();
      return { ...binding, currentTitle: title };
    }
    title = extractUserdataCurrentTitle(current) || title;
  } catch (error) {
    const missing = error && typeof error === "object" && "code" in error && error.code === "ENOENT";
    const invalidLegacy = error instanceof SyntaxError && !scorePublication(binding.taikoId);
    if (!missing && !invalidLegacy) throw error;
  }
  return { ...binding, currentTitle: title };
}
