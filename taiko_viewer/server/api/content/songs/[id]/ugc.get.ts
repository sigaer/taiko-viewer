import { getPublicChartUgcSummary, resolveChart } from "~/server/services/ugc";
import { setAnonymousSWR } from "~/server/utils/cache-policy";

export default defineEventHandler(async (event) => {
  setAnonymousSWR(event, 15, 60);
  const chart = await resolveChart(event.context.params?.id, getQuery(event).difficulty);
  return getPublicChartUgcSummary(chart);
});
