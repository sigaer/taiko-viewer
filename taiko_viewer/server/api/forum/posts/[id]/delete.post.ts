import { deleteForumPostByAuthor } from "~/server/utils/forum";

export default defineEventHandler(async (event) => deleteForumPostByAuthor(event, event.context.params?.id));
