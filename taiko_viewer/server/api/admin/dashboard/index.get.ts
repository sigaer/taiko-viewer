import { getAdminDashboardPayload } from "~/server/utils/admin/dashboard";
import { requireTaikoAdminSession } from "~/server/utils/admin/auth";
import { recordAdminAction } from "~/server/utils/admin/audit";

export default defineEventHandler(async (event) => {
  const session = await requireTaikoAdminSession(event);
  const payload = await getAdminDashboardPayload();
  await recordAdminAction({
    actorType: "admin",
    actorId: String(session.user.id),
    actorName: session.user.username,
    source: "admin-web",
    targetType: "dashboard",
    targetKey: "overview",
    action: "read"
  }).catch(() => undefined);
  return payload;
});
