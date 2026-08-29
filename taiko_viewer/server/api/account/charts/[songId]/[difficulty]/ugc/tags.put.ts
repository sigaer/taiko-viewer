import { readBody } from "h3";
import {
  enforceUgcWriteRateLimit,
  replaceChartTags,
  resolveChart
} from "~/server/services/ugc";
import { requireAccountUser } from "~/server/utils/account";
import { setPrivateNoStore } from "~/server/utils/cache-policy";

export default defineEventHandler(async (event) => {
  setPrivateNoStore(event);
  const user = await requireAccountUser(event);
  enforceUgcWriteRateLimit(event, user.id, "tags");
  const chart = await resolveChart(event.context.params?.songId, event.context.params?.difficulty);
  const body = await readBody(event);
  return replaceChartTags(user.id, chart, body?.slugs);
});
