import { readBody } from "h3";
import { toggleForumFollow } from "~/server/utils/forum";

export default defineEventHandler(async (event) =>
  toggleForumFollow(event, event.context.params?.id, await readBody(event)),
);
