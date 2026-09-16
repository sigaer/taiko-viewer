import { createError, getQuery, setHeader } from "h3";
import { requireTaikoAdminSession } from "~/server/utils/admin/auth";
import { isAnnualReportOperator } from "~/server/utils/admin/annual-report-access";
import { getAccountAnnualSummaryEnvelope } from "~/server/services/account/annual-summary";

// Read the owner's real entry state without impersonating their login or
// creating a build. The existing operator boundary is unchanged.
export default defineEventHandler(async event => {
  const session = await requireTaikoAdminSession(event);
  if (!isAnnualReportOperator(session.user.username)) throw createError({ statusCode: 403, statusMessage: "无年度报告管理权限" });
  const query = getQuery(event);
  const userId = Number(query.userId);
  if (!Number.isSafeInteger(userId) || userId <= 0) throw createError({ statusCode: 400, statusMessage: "目标用户无效" });
  setHeader(event, "Cache-Control", "private, no-store");
  const envelope = await getAccountAnnualSummaryEnvelope(userId, "annual_2026", query.locale);
  return {
    state: envelope.state,
    currentBinding: { id: envelope.currentBinding.id, taikoId: envelope.currentBinding.taikoId },
    buildJob: envelope.buildJob,
    summaryId: envelope.summary?.summaryId || null,
    algorithmVersion: envelope.summary?.provenance.algorithmVersion || null
  };
});
