import { createError, getRouterParam, setHeader } from "h3";
import { getAdminAnnualMyDon, readAnnualImage } from "~/server/services/account/annual-summary";
import { requireTaikoAdminSession } from "~/server/utils/admin/auth";
import { isAnnualReportOperator } from "~/server/utils/admin/annual-report-access";

export default defineEventHandler(async (event) => {
  const session = await requireTaikoAdminSession(event);
  if (!isAnnualReportOperator(session.user.username)) throw createError({ statusCode: 403, statusMessage: "无年度报告管理权限" });
  const result = await getAdminAnnualMyDon(String(getRouterParam(event, "summaryId") || ""));
  setHeader(event, "Content-Type", "image/png");
  setHeader(event, "Cache-Control", "private, no-store");
  setHeader(event, "Referrer-Policy", "no-referrer");
  return result.kind === "snapshot" ? readAnnualImage(result.path) : result.buffer;
});
