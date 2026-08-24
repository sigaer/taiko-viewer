import { getPersonalRatingSummary } from "~/server/services/account/personal";
import { requireAccountUser } from "~/server/utils/account";

export default defineEventHandler(async (event) => {
  const user = await requireAccountUser(event);
  return getPersonalRatingSummary(user.id);
});
