import { readBody } from "h3";
import { enforceUgcWriteRateLimit, moderateChartTip } from "~/server/services/ugc";
import { requireUgcModerator } from "~/server/utils/admin/ugc-auth";
import { setPrivateNoStore } from "~/server/utils/cache-policy";

export default defineEventHandler(async (event) => {
  setPrivateNoStore(event);
  const moderator = await requireUgcModerator(event);
  enforceUgcWriteRateLimit(event, moderator.operatorUserId || 0, "admin_moderation");
  const body = await readBody(event);
  return moderateChartTip(moderator.operatorUserId, body?.tipId, body?.action, body?.reason);
});
