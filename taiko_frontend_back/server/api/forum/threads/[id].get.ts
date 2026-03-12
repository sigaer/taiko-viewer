import { getForumThreadDetail } from "~/server/utils/forum";

export default defineEventHandler(async (event) => getForumThreadDetail(event, event.context.params?.id));
