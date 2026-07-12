import { getQuery, getRouterParam, setHeader } from "h3";
import { getPublicAnnualShare } from "~/server/services/account/annual-summary";
import { enforceAnnualPublicRateLimit } from "~/server/services/account/annual-summary/security";

export default defineEventHandler(async (event) => {
  enforceAnnualPublicRateLimit(event);
  setHeader(event, "Cache-Control", "private, no-store");
  setHeader(event, "Referrer-Policy", "no-referrer");
  setHeader(event, "X-Robots-Tag", "noindex, nofollow, noarchive");
  return getPublicAnnualShare(getRouterParam(event, "token"), getQuery(event).locale);
});
