import { negotiatePortfolioRead } from '~/server/services/goals/portfolio-read-negotiation';
import { getQuery, setHeader } from "h3";
import { requireAccountUser } from "~/server/utils/account";
import { getSkillPassport } from "~/server/services/growth-passport/service";
import { resolveSkillPassportRange } from "~/server/services/growth-passport/range";

export default defineEventHandler(async event => {
  setHeader(event, "Cache-Control", "private, no-store");
  setHeader(event, "Vary", "Cookie, X-Goal-Portfolio-Schema");
  const user = await requireAccountUser(event);
  return negotiatePortfolioRead(event,user.id,await getSkillPassport(user.id, resolveSkillPassportRange(getQuery(event))));
});
