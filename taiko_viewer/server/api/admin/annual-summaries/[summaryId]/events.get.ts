import { getQuery, getRouterParam } from "h3";
import { getAdminAnnualEvents } from "~/server/services/account/annual-summary";
import { requireTaikoAdminSession } from "~/server/utils/admin/auth";

export default defineEventHandler(async (event) => {
  await requireTaikoAdminSession(event);
  return getAdminAnnualEvents(String(getRouterParam(event, "summaryId") || ""), getQuery(event));
});
