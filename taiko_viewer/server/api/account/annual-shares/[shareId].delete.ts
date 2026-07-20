import { getRouterParam } from "h3";
import { revokeAccountAnnualShare } from "~/server/services/account/annual-summary";
import { requireAccountAnnualSummaryUser } from "~/server/services/account/annual-summary/access";

export default defineEventHandler(async (event) => {
  const user = await requireAccountAnnualSummaryUser(event);
  return revokeAccountAnnualShare(user.id, String(getRouterParam(event, "shareId") || ""));
});
