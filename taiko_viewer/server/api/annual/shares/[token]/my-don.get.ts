import { getRouterParam, setHeader } from "h3";
import { getPublicAnnualMyDonPath, readAnnualImage } from "~/server/services/account/annual-summary";
import { enforceAnnualPublicRateLimit } from "~/server/services/account/annual-summary/security";

export default defineEventHandler(async (event) => {
  enforceAnnualPublicRateLimit(event);
  const path = await getPublicAnnualMyDonPath(getRouterParam(event, "token"));
  setHeader(event, "Content-Type", "image/png");
  setHeader(event, "Cache-Control", "private, no-store");
  setHeader(event, "Referrer-Policy", "no-referrer");
  return readAnnualImage(path);
});
