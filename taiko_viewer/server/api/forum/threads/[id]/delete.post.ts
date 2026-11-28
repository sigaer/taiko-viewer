import { deleteForumThreadByAuthor } from "~/server/utils/forum";

export default defineEventHandler(async (event) => deleteForumThreadByAuthor(event, event.context.params?.id));
