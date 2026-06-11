import { requireTaikoAdminSession } from "~/server/utils/admin/auth";
import { exportAdminSongs } from "~/server/utils/admin/songs";
import { recordAdminAction } from "~/server/utils/admin/audit";

export default defineEventHandler(async (event) => {
  const session = await requireTaikoAdminSession(event);
  const payload = await exportAdminSongs();
  await recordAdminAction({
    actorType: "admin",
    actorId: String(session.user.id),
    actorName: session.user.username,
    source: "admin-web",
    targetType: "song-data",
    targetKey: "export",
    action: "read"
  }).catch(() => undefined);
  return payload;
});
