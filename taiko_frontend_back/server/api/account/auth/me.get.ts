import { getCurrentAccountSummary } from "~/server/utils/account";

export default defineEventHandler(async (event) => {
  const user = await getCurrentAccountSummary(event);
  return {
    authenticated: Boolean(user),
    user
  };
});
