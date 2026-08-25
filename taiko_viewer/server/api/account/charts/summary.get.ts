import { getPersonalRatingSummary } from "~/server/services/account/personal";
import { requireAccountUser } from "~/server/utils/account";
import { setHeader } from "h3";

export default defineEventHandler(async (event) => {
  const user = await requireAccountUser(event);
  setHeader(event, "Cache-Control", "private, no-store");
  return getPersonalRatingSummary(user.id);
});
