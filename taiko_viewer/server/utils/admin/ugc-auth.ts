import type { H3Event } from "h3";
import { requireModerator } from "~/server/internal/forum/shared";
import { getTaikoAdminSession } from "~/server/utils/admin/auth";
import { resolveUgcOperatorAccountId } from "~/server/services/ugc";

export const requireUgcModerator = async (event: H3Event) => {
  const adminSession = await getTaikoAdminSession(event);
  if (adminSession) {
    return {
      operatorUserId: await resolveUgcOperatorAccountId(adminSession.user.id, adminSession.user.username),
      username: adminSession.user.username
    };
  }
  const { user } = await requireModerator(event);
  return { operatorUserId: user.id, username: user.username };
};
