import { readBody } from "h3";
import { enforceUgcWriteRateLimit, moderateChartTip } from "~/server/services/ugc";
import { requireModerator } from "~/server/internal/forum/shared";
import { setPrivateNoStore } from "~/server/utils/cache-policy";

export default defineEventHandler(async (event) => {
  setPrivateNoStore(event);
  const { user } = await requireModerator(event);
  enforceUgcWriteRateLimit(event, user.id, "admin_moderation");
  const body = await readBody(event);
  return moderateChartTip(user.id, body?.tipId, body?.action, body?.reason);
});
