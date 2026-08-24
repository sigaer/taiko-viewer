import { getQuery } from "h3";
import { listAccountSongs, requireAccountUser } from "~/server/utils/account";

export default defineEventHandler(async (event) => {
  const user = await requireAccountUser(event);
  const query = getQuery(event);
  return listAccountSongs(user.id, {
    keyword: query.keyword,
    level: query.level,
    page: query.page,
    pageSize: query.pageSize,
    scoreOnly: query.scoreOnly
  });
});
