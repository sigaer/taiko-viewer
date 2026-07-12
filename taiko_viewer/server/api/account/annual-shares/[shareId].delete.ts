import { getRouterParam } from "h3";
import { revokeAccountAnnualShare } from "~/server/services/account/annual-summary";
import { requireAccountUser } from "~/server/utils/account";

export default defineEventHandler(async (event) => {
  const user = await requireAccountUser(event);
  return revokeAccountAnnualShare(user.id, String(getRouterParam(event, "shareId") || ""));
});
