import { getQuery } from "h3";
import { requireTaikoAdminSession } from "~/server/utils/admin/auth";
import { listAdminSongs } from "~/server/utils/admin/songs";
import { recordAdminAction } from "~/server/utils/admin/audit";

export default defineEventHandler(async (event) => {
  const session = await requireTaikoAdminSession(event);
  const payload = await listAdminSongs(getQuery(event));
  await recordAdminAction({
    actorType: "admin",
    actorId: String(session.user.id),
    actorName: session.user.username,
    source: "admin-web",
    targetType: "song-data",
    targetKey: "catalog",
    action: "read",
    extra: getQuery(event)
  }).catch(() => undefined);
  return payload;
});
