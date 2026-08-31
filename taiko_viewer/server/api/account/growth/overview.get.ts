import { setHeader } from "h3";
import { requireAccountUser } from "~/server/utils/account";
import { getPlayerGrowthOverview } from "~/server/services/account/growth";

export default defineEventHandler(async (event) => {
  const user = await requireAccountUser(event);
  setHeader(event, "Cache-Control", "private, no-store");
  setHeader(event, "Vary", "Cookie");
  return getPlayerGrowthOverview(user.id);
});
