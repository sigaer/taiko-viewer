import { getQuery } from "h3";
import { getAccountVersionSummaryPayload } from "~/server/services/account/version-summary/summary";
import { requireAccountUser } from "~/server/utils/account";
import { resolveViewerLocale } from "~/server/utils/locale";

export default defineEventHandler(async (event) => {
  const user = await requireAccountUser(event);
  const query = getQuery(event);
  return getAccountVersionSummaryPayload(user.id, {
    versionKey: query.version ? String(query.version) : undefined,
    refresh: query.refresh === "1" || query.refresh === "true",
    locale: resolveViewerLocale(event)
  });
});
