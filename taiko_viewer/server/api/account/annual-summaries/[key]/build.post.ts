import { getRouterParam, readBody, setResponseStatus } from "h3";
import { queueAccountAnnualSummaryBuild } from "~/server/services/account/annual-summary";
import { requireAccountAnnualSummaryUser } from "~/server/services/account/annual-summary/access";
import { resolveViewerLocale } from "~/server/utils/locale";

export default defineEventHandler(async (event) => {
  const user = await requireAccountAnnualSummaryUser(event);
  const body = ((await readBody<{ force?: unknown }>(event).catch(() => ({}))) || {}) as { force?: unknown };
  const payload = await queueAccountAnnualSummaryBuild(user.id, getRouterParam(event, "key"), {
    force: body.force === true,
    locale: resolveViewerLocale(event)
  });
  setResponseStatus(event, payload.job.status === "completed" ? 200 : 202);
  return payload;
});
