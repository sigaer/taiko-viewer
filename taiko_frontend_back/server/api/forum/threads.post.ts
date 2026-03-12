import { readBody } from "h3";
import { createForumThread } from "~/server/utils/forum";

export default defineEventHandler(async (event) => createForumThread(event, await readBody(event)));
