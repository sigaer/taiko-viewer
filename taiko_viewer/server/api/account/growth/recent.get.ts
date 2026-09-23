import { setHeader } from "h3";
import { requireAccountUser } from "~/server/utils/account";
import { getRecentGrowth } from "~/server/services/growth-recent/service";

export default defineEventHandler(async event => {
  setHeader(event, "Cache-Control", "private, no-store");
  setHeader(event, "Vary", "Cookie");
  const user = await requireAccountUser(event);
  return getRecentGrowth(user.id);
});
