import { createError, getRouterParam, readBody } from "h3";
import type { ResultSetHeader } from "mysql2/promise";
import { requireTaikoAdminSession } from "~/server/utils/admin/auth";
import { ensureAccountSchema, getAccountDb } from "~/server/utils/account-db";
import { recordAdminAction } from "~/server/utils/admin/audit";
import { setPrivateNoStore } from "~/server/utils/cache-policy";

export default defineEventHandler(async (event) => {
  setPrivateNoStore(event);
  const session = await requireTaikoAdminSession(event);
  const body = await readBody(event);
  if (!body || !["published", "hidden"].includes(body.status)) {
    throw createError({ statusCode: 400, statusMessage: "感想状态无效" });
  }
  await ensureAccountSchema();
  const [result] = await getAccountDb().execute<ResultSetHeader>(
    "UPDATE web_annual_poster_reactions SET status = ? WHERE id = ?",
    [body.status, String(getRouterParam(event, "id") || "")]
  );
  if (!result.affectedRows) throw createError({ statusCode: 404, statusMessage: "感想不存在" });
  await recordAdminAction({
    actorType: "admin", actorId: String(session.user.id), actorName: session.user.username,
    source: "annual-poster", targetType: "annual-reaction",
    targetKey: String(getRouterParam(event, "id")), action: "update",
    after: { status: body.status }
  });
  return { status: body.status };
});
