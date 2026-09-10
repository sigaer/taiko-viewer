import { getQuery, getRouterParam, setHeader } from "h3";
import { getInternalAnnualShareCardPayload } from "~/server/services/account/annual-summary";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  setHeader(event, "Cache-Control", "no-store");
  setHeader(event, "Referrer-Policy", "no-referrer");
  setHeader(event, "X-Robots-Tag", "noindex, nofollow, noarchive");
  return getInternalAnnualShareCardPayload(
    String(getRouterParam(event, "summaryId") || ""),
    query.token,
    query.locale
  );
});
