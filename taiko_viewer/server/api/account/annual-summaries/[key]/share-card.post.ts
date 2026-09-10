import { getRouterParam, readBody } from "h3";
import { createAccountAnnualShareCard } from "~/server/services/account/annual-summary";
import { requireAccountAnnualSummaryUser } from "~/server/services/account/annual-summary/access";
import { resolveViewerLocale } from "~/server/utils/locale";

export default defineEventHandler(async (event) => {
  const user = await requireAccountAnnualSummaryUser(event);
  const body = ((await readBody<{ locale?: unknown }>(event).catch(() => ({}))) || {}) as { locale?: unknown };
  return await createAccountAnnualShareCard(
    user.id,
    String(getRouterParam(event, "key") || ""),
    body.locale || resolveViewerLocale(event)
  );
});
