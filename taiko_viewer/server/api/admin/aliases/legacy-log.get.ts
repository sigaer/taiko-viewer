import { getQuery } from "h3";
import { listLegacyAliasLogs } from "~/server/utils/admin/aliases";
import { requireTaikoAdminSession } from "~/server/utils/admin/auth";
import { recordAdminAction } from "~/server/utils/admin/audit";

export default defineEventHandler(async (event) => {
  const session = await requireTaikoAdminSession(event);
  const payload = await listLegacyAliasLogs(getQuery(event));
  await recordAdminAction({
    actorType: "admin",
    actorId: String(session.user.id),
    actorName: session.user.username,
    source: "admin-web",
    targetType: "song-alias-log",
    targetKey: "legacy",
    action: "read"
  }).catch(() => undefined);
  return payload;
});
