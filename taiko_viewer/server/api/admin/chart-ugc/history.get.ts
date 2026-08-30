import { getQuery } from "h3";
import { listChartUgcModerationHistory } from "~/server/services/ugc";
import { requireUgcModerator } from "~/server/utils/admin/ugc-auth";
import { setPrivateNoStore } from "~/server/utils/cache-policy";

export default defineEventHandler(async (event) => {
  setPrivateNoStore(event);
  await requireUgcModerator(event);
  return { items: await listChartUgcModerationHistory(getQuery(event).limit) };
});
