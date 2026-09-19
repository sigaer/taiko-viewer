import { getQuery, setHeader } from "h3";
import { requireAccountUser } from "~/server/utils/account";
import { getWeeklyGrowthRecap } from "~/server/services/growth-weekly/service";
import { resolveWeeklyGrowthWindow } from "~/server/services/growth-weekly/range";

export default defineEventHandler(async event => {
  setHeader(event, "Cache-Control", "private, no-store");
  setHeader(event, "Vary", "Cookie");
  const user = await requireAccountUser(event);
  return getWeeklyGrowthRecap(user.id, resolveWeeklyGrowthWindow(getQuery(event)));
});
