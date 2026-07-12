import { getRouterParam } from "h3";
import { getAccountAnnualJob } from "~/server/services/account/annual-summary";
import { requireAccountUser } from "~/server/utils/account";
import { resolveViewerLocale } from "~/server/utils/locale";

export default defineEventHandler(async (event) => {
  const user = await requireAccountUser(event);
  return getAccountAnnualJob(
    user.id,
    String(getRouterParam(event, "jobId") || ""),
    "build",
    resolveViewerLocale(event)
  );
});
