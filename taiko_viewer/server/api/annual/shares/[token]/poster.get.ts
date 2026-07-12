import { getQuery, getRouterParam, setHeader } from "h3";
import { getPublicAnnualPosterPath, readAnnualImage } from "~/server/services/account/annual-summary";
import { enforceAnnualPublicRateLimit } from "~/server/services/account/annual-summary/security";

export default defineEventHandler(async (event) => {
  enforceAnnualPublicRateLimit(event);
  const path = await getPublicAnnualPosterPath(getRouterParam(event, "token"), getQuery(event).locale);
  setHeader(event, "Content-Type", "image/png");
  setHeader(event, "Cache-Control", "private, no-store");
  setHeader(event, "Referrer-Policy", "no-referrer");
  setHeader(event, "X-Robots-Tag", "noindex, nofollow, noarchive");
  return readAnnualImage(path);
});
