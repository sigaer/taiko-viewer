import { readBody } from "h3";
import { enforceUgcWriteRateLimit, reportChartTip } from "~/server/services/ugc";
import { requireAccountUser } from "~/server/utils/account";
import { setPrivateNoStore } from "~/server/utils/cache-policy";

export default defineEventHandler(async (event) => {
  setPrivateNoStore(event);
  const user = await requireAccountUser(event);
  enforceUgcWriteRateLimit(event, user.id, "report");
  const body = await readBody(event);
  return reportChartTip(user.id, event.context.params?.tipId, body?.reason);
});
