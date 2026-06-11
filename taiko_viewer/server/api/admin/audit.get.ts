import { getQuery } from "h3";
import { listAdminActionLogs, recordAdminAction } from "~/server/utils/admin/audit";
import { requireTaikoAdminSession } from "~/server/utils/admin/auth";

export default defineEventHandler(async (event) => {
  const session = await requireTaikoAdminSession(event);
  const payload = await listAdminActionLogs(getQuery(event));
  await recordAdminAction({
    actorType: "admin",
    actorId: String(session.user.id),
    actorName: session.user.username,
    source: "admin-web",
    targetType: "audit",
    targetKey: "action-log",
    action: "read"
  }).catch(() => undefined);
  return payload;
});
