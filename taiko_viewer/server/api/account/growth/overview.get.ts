import { negotiatePortfolioRead } from '~/server/services/goals/portfolio-read-negotiation';
import { setHeader } from "h3";
import { requireAccountUser } from "~/server/utils/account";
import { getPlayerGrowthOverview } from "~/server/services/account/growth";

export default defineEventHandler(async (event) => {
  setHeader(event, "Cache-Control", "private, no-store");
  setHeader(event, "Vary", "Cookie, X-Goal-Portfolio-Schema");
  const user = await requireAccountUser(event);
  return negotiatePortfolioRead(event,user.id,await getPlayerGrowthOverview(user.id));
});
