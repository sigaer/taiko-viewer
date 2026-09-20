import { getRouterParam, readBody, setHeader, setResponseStatus } from "h3";
import { queueAccountAnnualSummaryBuild } from "~/server/services/account/annual-summary";
import { requireAccountAnnualSummaryUser } from "~/server/services/account/annual-summary/access";
import { resolveViewerLocale } from "~/server/utils/locale";

export default defineEventHandler(async (event) => {
  const user = await requireAccountAnnualSummaryUser(event);
  const body = await readBody(event);
  let payload;
  try {
    payload = await queueAccountAnnualSummaryBuild(user.id, getRouterParam(event, "key"), {
      locale: resolveViewerLocale(event),
      retryFailed: body?.retryFailed === true
    });
  } catch (error) {
    const retryAfter = Number((error as { retryAfter?: number })?.retryAfter || 0);
    if (retryAfter > 0) setHeader(event, "Retry-After", String(Math.ceil(retryAfter)));
    throw error;
  }
  setResponseStatus(event, ["completed", "failed", "expired", "cancelled"].includes(payload.job.status) ? 200 : 202);
  return payload;
});
