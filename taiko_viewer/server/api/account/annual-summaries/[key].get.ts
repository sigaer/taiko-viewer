import { getRouterParam } from "h3";
import {
  getAccountAnnualSummaryById,
  getAccountAnnualSummaryEnvelope
} from "~/server/services/account/annual-summary";
import { ANNUAL_VERSION_KEY } from "~/server/services/account/annual-summary/constants";
import { requireAccountUser } from "~/server/utils/account";
import { resolveViewerLocale } from "~/server/utils/locale";

export default defineEventHandler(async (event) => {
  const user = await requireAccountUser(event);
  const key = String(getRouterParam(event, "key") || "").trim();
  const locale = resolveViewerLocale(event);
  return key === ANNUAL_VERSION_KEY
    ? getAccountAnnualSummaryEnvelope(user.id, key, locale)
    : getAccountAnnualSummaryById(user.id, key, locale);
});
