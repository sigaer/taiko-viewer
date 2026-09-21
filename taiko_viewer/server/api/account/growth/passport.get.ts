import { getQuery, setHeader } from "h3";
import { requireAccountUser } from "~/server/utils/account";
import { getSkillPassport } from "~/server/services/growth-passport/service";
import { resolveSkillPassportRange } from "~/server/services/growth-passport/range";

export default defineEventHandler(async event => {
  setHeader(event, "Cache-Control", "private, no-store");
  setHeader(event, "Vary", "Cookie");
  const user = await requireAccountUser(event);
  return getSkillPassport(user.id, resolveSkillPassportRange(getQuery(event)));
});
