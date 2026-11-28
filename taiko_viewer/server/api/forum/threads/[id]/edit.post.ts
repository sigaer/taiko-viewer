import { readBody } from "h3";
import { updateForumThreadByAuthor } from "~/server/utils/forum";

export default defineEventHandler(async (event) =>
  updateForumThreadByAuthor(event, event.context.params?.id, await readBody(event))
);
