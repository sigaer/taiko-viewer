import { getRouterParam, readBody } from "h3";
import { createAccountAnnualShare } from "~/server/services/account/annual-summary";
import { requireAccountUser } from "~/server/utils/account";
import { resolveViewerLocale } from "~/server/utils/locale";

export default defineEventHandler(async (event) => {
  const user = await requireAccountUser(event);
  const body = ((await readBody<{ locale?: unknown }>(event).catch(() => ({}))) || {}) as { locale?: unknown };
  return createAccountAnnualShare(
    user.id,
    String(getRouterParam(event, "key") || ""),
    body.locale || resolveViewerLocale(event)
  );
});
