import { createError, readBody } from "h3";
import { queueAdminAnnualSummaryBuildForBinding } from "~/server/services/account/annual-summary";
import { requireTaikoAdminSession } from "~/server/utils/admin/auth";
import { isAnnualReportOperator } from "~/server/utils/admin/annual-report-access";
export default defineEventHandler(async (event) => {
  const session = await requireTaikoAdminSession(event);
  if (!isAnnualReportOperator(session.user.username)) throw createError({ statusCode: 403, statusMessage: "无年度报告管理权限" });
  const body = await readBody<{ userId?: unknown; force?: unknown }>(event);
  const userId = Number(body?.userId); const bindingId = Number((body as any)?.bindingId);
  if (!Number.isSafeInteger(userId) || userId <= 0) throw createError({ statusCode: 400, statusMessage: "目标用户无效" });
  if (!Number.isSafeInteger(bindingId) || bindingId <= 0) throw createError({ statusCode: 400, statusMessage: "目标绑定无效" });
  return queueAdminAnnualSummaryBuildForBinding(userId, bindingId, "annual_2026", { force: body?.force === true, locale: "zh" });
});
