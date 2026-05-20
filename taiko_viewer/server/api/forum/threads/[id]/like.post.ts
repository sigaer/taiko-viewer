import { toggleForumThreadLike } from "~/server/utils/forum";

export default defineEventHandler(async (event) => toggleForumThreadLike(event, event.context.params?.id));
