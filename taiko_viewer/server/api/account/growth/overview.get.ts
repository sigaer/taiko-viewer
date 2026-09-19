import { setHeader } from "h3";
import { requireAccountUser } from "~/server/utils/account";
import { getPlayerGrowthOverview } from "~/server/services/account/growth";

export default defineEventHandler(async (event) => {
  setHeader(event, "Cache-Control", "private, no-store");
  setHeader(event, "Vary", "Cookie");
  const user = await requireAccountUser(event);
  return getPlayerGrowthOverview(user.id);
});
