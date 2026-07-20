import { getRouterParam } from "h3";
import { getAccountAnnualJob } from "~/server/services/account/annual-summary";
import { requireAccountAnnualSummaryUser } from "~/server/services/account/annual-summary/access";
import { resolveViewerLocale } from "~/server/utils/locale";

export default defineEventHandler(async (event) => {
  const user = await requireAccountAnnualSummaryUser(event);
  return getAccountAnnualJob(
    user.id,
    String(getRouterParam(event, "jobId") || ""),
    "build",
    resolveViewerLocale(event)
  );
});
