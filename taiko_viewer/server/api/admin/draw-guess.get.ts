import { getQuery } from "h3";
import { requireTaikoAdminSession } from "~/server/utils/admin/auth";
import { recordAdminAction } from "~/server/utils/admin/audit";
import { listAdminDrawGuess } from "~/server/utils/admin/draw-guess";

export default defineEventHandler(async (event) => {
  const session = await requireTaikoAdminSession(event);
  const query = getQuery(event);
  const payload = await listAdminDrawGuess(query);
  await recordAdminAction({
    actorType: "admin",
    actorId: String(session.user.id),
    actorName: session.user.username,
    source: "admin-web",
    targetType: "draw-guess-record",
    targetKey: "list",
    action: "read",
    extra: query
  }).catch(() => undefined);
  return payload;
});
