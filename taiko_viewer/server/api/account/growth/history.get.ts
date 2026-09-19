import { getQuery, setHeader } from "h3";
import { requireAccountUser } from "~/server/utils/account";
import { getGrowthHistory } from "~/server/services/growth-history/service";
import { resolveGrowthHistoryRange } from "~/server/services/growth-history/range";

export default defineEventHandler(async event => {
  setHeader(event, "Cache-Control", "private, no-store");
  setHeader(event, "Vary", "Cookie");
  const user = await requireAccountUser(event);
  return getGrowthHistory(user.id, resolveGrowthHistoryRange(getQuery(event)));
});
