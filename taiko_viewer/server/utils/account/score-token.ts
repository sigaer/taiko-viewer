import type { H3Event } from "h3";
import { createError } from "h3";
import { manageViewerScoreToken } from "../../services/account/score-token-authority.ts";
import { requireAccountUser } from "./auth";

export const manageAccountScoreToken = async (event: H3Event, body: Record<string, unknown>) => {
  const user = await requireAccountUser(event);
  const action = String(body?.action || "").trim().toLowerCase();
  if (action !== "issue" && action !== "revoke") {
    throw createError({ statusCode: 400, statusMessage: "不支持的 token 管理操作" });
  }
  return manageViewerScoreToken(user.id, action);
};
