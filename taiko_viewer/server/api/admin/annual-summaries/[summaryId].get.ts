import { createError, getQuery, getRouterParam } from "h3";
import { getAdminAnnualSummaryById } from "~/server/services/account/annual-summary";
import { requireTaikoAdminSession } from "~/server/utils/admin/auth";
import { isAnnualReportOperator } from "~/server/utils/admin/annual-report-access";
export default defineEventHandler(async (event) => {
  const session = await requireTaikoAdminSession(event);
  if (!isAnnualReportOperator(session.user.username)) throw createError({ statusCode: 403, statusMessage: "无年度报告管理权限" });
  return { summary: await getAdminAnnualSummaryById(String(getRouterParam(event, "summaryId") || ""), getQuery(event).locale) };
});
