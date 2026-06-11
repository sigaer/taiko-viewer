import { getGuideAdminOverview } from "~/server/utils/admin/guides";
import { requireTaikoAdminSession } from "~/server/utils/admin/auth";
import { recordAdminAction } from "~/server/utils/admin/audit";

export default defineEventHandler(async (event) => {
  const session = await requireTaikoAdminSession(event);
  const payload = await getGuideAdminOverview();
  await recordAdminAction({
    actorType: "admin",
    actorId: String(session.user.id),
    actorName: session.user.username,
    source: "admin-web",
    targetType: "guide",
    targetKey: "overview",
    action: "read"
  }).catch(() => undefined);
  return payload;
});
