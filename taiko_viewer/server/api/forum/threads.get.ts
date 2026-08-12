import { getQuery } from "h3";
import { listForumThreads } from "~/server/utils/forum";
import { setAnonymousSWR } from "~/server/utils/cache-policy";

export default defineEventHandler(async (event) => {
  setAnonymousSWR(event);
  return listForumThreads(event, getQuery(event));
});
