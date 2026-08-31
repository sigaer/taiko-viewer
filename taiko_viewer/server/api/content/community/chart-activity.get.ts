import { getCommunityChartActivity } from "~/server/services/ugc";
import { setAnonymousSWR } from "~/server/utils/cache-policy";

export default defineEventHandler(async (event) => {
  setAnonymousSWR(event, 15, 30);
  return getCommunityChartActivity(8);
});
