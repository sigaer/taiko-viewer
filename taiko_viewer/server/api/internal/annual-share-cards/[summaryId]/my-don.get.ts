import { getQuery, getRouterParam, setHeader } from "h3";
import { getInternalAnnualShareCardMyDon, readAnnualImage } from "~/server/services/account/annual-summary";

export default defineEventHandler(async (event) => {
  const result = await getInternalAnnualShareCardMyDon(
    String(getRouterParam(event, "summaryId") || ""),
    getQuery(event).token
  );
  setHeader(event, "Content-Type", "image/png");
  setHeader(event, "Cache-Control", "no-store");
  setHeader(event, "Referrer-Policy", "no-referrer");
  return result.kind === "snapshot" ? readAnnualImage(result.path) : result.buffer;
});
