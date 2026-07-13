import { getRouterParam } from "h3";
import { getAccountSongScores, requireAccountUser } from "~/server/utils/account";

export default defineEventHandler(async (event) => {
  const user = await requireAccountUser(event);
  return getAccountSongScores(user.id, getRouterParam(event, "songNo"));
});
