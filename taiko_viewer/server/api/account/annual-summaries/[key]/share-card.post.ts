import { getRouterParam, readBody } from "h3";
import { createAccountAnnualShareCard } from "~/server/services/account/annual-summary";
import { requireAccountAnnualSummaryUser } from "~/server/services/account/annual-summary/access";
import { resolveViewerLocale } from "~/server/utils/locale";

export default defineEventHandler(async (event) => {
  const user = await requireAccountAnnualSummaryUser(event);
  const body = ((await readBody<{ locale?: unknown; syncCommunity?: unknown }>(event).catch(() => ({}))) || {}) as {
    locale?: unknown;
    syncCommunity?: unknown;
  };
  return await createAccountAnnualShareCard(event, user.id, String(getRouterParam(event, "key") || ""), {
    locale: body.locale || resolveViewerLocale(event),
    syncCommunity: body.syncCommunity,
    actorUsername: user.username
  });
});
