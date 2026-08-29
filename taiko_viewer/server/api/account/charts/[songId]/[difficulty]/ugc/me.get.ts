import { getViewerChartUgcState, resolveChart } from "~/server/services/ugc";
import { requireAccountUser } from "~/server/utils/account";
import { setPrivateNoStore } from "~/server/utils/cache-policy";

export default defineEventHandler(async (event) => {
  setPrivateNoStore(event);
  const user = await requireAccountUser(event);
  const chart = await resolveChart(event.context.params?.songId, event.context.params?.difficulty);
  return getViewerChartUgcState(chart, user.id);
});
