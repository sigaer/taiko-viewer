import { requireTaikoAdminSession } from "~/server/utils/admin/auth";
import { getAdminSongDetail } from "~/server/utils/admin/songs";
import { recordAdminAction } from "~/server/utils/admin/audit";

export default defineEventHandler(async (event) => {
  const session = await requireTaikoAdminSession(event);
  const songId = getRouterParam(event, "id");
  const payload = await getAdminSongDetail(songId);
  await recordAdminAction({
    actorType: "admin",
    actorId: String(session.user.id),
    actorName: session.user.username,
    source: "admin-web",
    targetType: "song-data",
    targetKey: String(songId || ""),
    action: "read"
  }).catch(() => undefined);
  return payload;
});
