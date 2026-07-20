import { getRouterParam, readBody, setResponseStatus } from "h3";
import { queueAccountAnnualPoster } from "~/server/services/account/annual-summary";
import { requireAccountAnnualSummaryUser } from "~/server/services/account/annual-summary/access";
import { resolveViewerLocale } from "~/server/utils/locale";

export default defineEventHandler(async (event) => {
  const user = await requireAccountAnnualSummaryUser(event);
  const body = ((await readBody<{ shareId?: unknown; locale?: unknown }>(event).catch(() => ({}))) || {}) as {
    shareId?: unknown;
    locale?: unknown;
  };
  const payload = await queueAccountAnnualPoster(user.id, String(getRouterParam(event, "key") || ""), {
    shareId: body.shareId,
    locale: body.locale || resolveViewerLocale(event)
  });
  setResponseStatus(event, 202);
  return payload;
});
