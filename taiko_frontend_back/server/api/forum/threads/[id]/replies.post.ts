import { readBody } from "h3";
import { createForumReply } from "~/server/utils/forum";

export default defineEventHandler(async (event) =>
  createForumReply(event, event.context.params?.id, await readBody(event))
);
