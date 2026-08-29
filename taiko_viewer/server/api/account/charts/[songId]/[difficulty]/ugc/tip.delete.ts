import { enforceUgcWriteRateLimit, deleteChartTip, resolveChart } from "~/server/services/ugc";
import { requireAccountUser } from "~/server/utils/account";
import { setPrivateNoStore } from "~/server/utils/cache-policy";

export default defineEventHandler(async (event) => {
  setPrivateNoStore(event);
  const user = await requireAccountUser(event);
  enforceUgcWriteRateLimit(event, user.id, "tip_write");
  const chart = await resolveChart(event.context.params?.songId, event.context.params?.difficulty);
  return deleteChartTip(user.id, chart);
});
