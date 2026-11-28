import { readBody } from "h3";
import { updateForumPostByAuthor } from "~/server/utils/forum";

export default defineEventHandler(async (event) =>
  updateForumPostByAuthor(event, event.context.params?.id, await readBody(event))
);
