import { getQuery } from "h3";
import { listAdminCovers } from "~/server/utils/admin/covers";
import { requireTaikoAdminSession } from "~/server/utils/admin/auth";
import { recordAdminAction } from "~/server/utils/admin/audit";

export default defineEventHandler(async (event) => {
  const session = await requireTaikoAdminSession(event);
  const payload = await listAdminCovers(getQuery(event));
  await recordAdminAction({
    actorType: "admin",
    actorId: String(session.user.id),
    actorName: session.user.username,
    source: "admin-web",
    targetType: "song-cover",
    targetKey: "list",
    action: "read",
    extra: getQuery(event)
  }).catch(() => undefined);
  return payload;
});
