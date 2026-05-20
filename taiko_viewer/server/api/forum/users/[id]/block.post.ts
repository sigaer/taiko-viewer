import { readBody } from "h3";
import { toggleForumBlock } from "~/server/utils/forum";

export default defineEventHandler(async (event) =>
  toggleForumBlock(event, event.context.params?.id, await readBody(event)),
);
