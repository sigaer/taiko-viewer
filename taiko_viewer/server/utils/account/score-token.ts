import type { H3Event } from "h3";
import { createError } from "h3";
import { getCurrentBindingRow } from "~/server/internal/account/shared";
import { requestScoreTokenManagement } from "~/server/internal/account/score-token";
import { requireAccountUser } from "./auth";

export const manageAccountScoreToken = async (event: H3Event, body: Record<string, unknown>) => {
  const user = await requireAccountUser(event);
  const binding = await getCurrentBindingRow(user.id);
  if (!binding) {
    throw createError({ statusCode: 400, statusMessage: "请先绑定鼓众 ID" });
  }
  if (binding.source === "manual") {
    throw createError({ statusCode: 400, statusMessage: "手动账号不支持网页成绩 token" });
  }

  const action = String(body?.action || "").trim().toLowerCase();
  if (action !== "issue" && action !== "revoke") {
    throw createError({ statusCode: 400, statusMessage: "不支持的 token 管理操作" });
  }
  return requestScoreTokenManagement(binding.taiko_id, action);
};
