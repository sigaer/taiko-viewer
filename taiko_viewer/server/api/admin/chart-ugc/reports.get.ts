import { listChartTipReports } from "~/server/services/ugc";
import { requireModerator } from "~/server/internal/forum/shared";
import { setPrivateNoStore } from "~/server/utils/cache-policy";

export default defineEventHandler(async (event) => {
  setPrivateNoStore(event);
  await requireModerator(event);
  return { items: await listChartTipReports() };
});
