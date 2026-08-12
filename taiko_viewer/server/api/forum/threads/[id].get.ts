import { getForumThreadDetail } from "~/server/utils/forum";
import { setAnonymousSWR } from "~/server/utils/cache-policy";

export default defineEventHandler(async (event) => {
  setAnonymousSWR(event);
  return getForumThreadDetail(event, event.context.params?.id);
});
