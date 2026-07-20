import { getCurrentAccountSummary } from "~/server/utils/account";
import { hasAccountAnnualSummaryAccess } from "~/server/services/account/annual-summary/access";

export default defineEventHandler(async (event) => {
  const user = await getCurrentAccountSummary(event);
  return {
    authenticated: Boolean(user),
    user: user
      ? { ...user, annualSummaryAccess: await hasAccountAnnualSummaryAccess(user.id) }
      : null
  };
});
