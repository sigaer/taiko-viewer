import { toggleForumPostLike } from "~/server/utils/forum";

export default defineEventHandler(async (event) => toggleForumPostLike(event, event.context.params?.id));
