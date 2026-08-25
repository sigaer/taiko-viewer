import { getPersonalRecommendations } from "~/server/services/account/personal";
import { setHeader } from "h3";
import { requireAccountUser } from "~/server/utils/account";

export default defineEventHandler(async (event) => {
  const user = await requireAccountUser(event);
  setHeader(event, "Cache-Control", "private, no-store");
  return getPersonalRecommendations(user.id);
});
