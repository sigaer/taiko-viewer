import { readBody } from "h3";
import { toggleForumThreadFavorite } from "~/server/utils/forum";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  return toggleForumThreadFavorite(
    event,
    event.context.params?.id,
    body?.enabled,
  );
});
