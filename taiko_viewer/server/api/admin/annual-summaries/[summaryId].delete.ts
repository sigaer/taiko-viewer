import { createError, getRouterParam } from "h3";
import { removeAdminAnnualSummary } from "~/server/services/account/annual-summary";
import { requireTaikoAdminSession } from "~/server/utils/admin/auth";
import { isAnnualReportOperator } from "~/server/utils/admin/annual-report-access";
import { recordAdminAction } from "~/server/utils/admin/audit";
export default defineEventHandler(async (event) => {
  const session = await requireTaikoAdminSession(event);
  if (!isAnnualReportOperator(session.user.username)) throw createError({ statusCode: 403, statusMessage: "无年度报告管理权限" });
  const summaryId = String(getRouterParam(event, "summaryId") || "");
  const result = await removeAdminAnnualSummary(summaryId);
  await recordAdminAction({ actorType: "admin", actorId: String(session.user.id), actorName: session.user.username, source: "admin-web", targetType: "annual-summary", targetKey: summaryId, action: "delete" });
  return result;
});
