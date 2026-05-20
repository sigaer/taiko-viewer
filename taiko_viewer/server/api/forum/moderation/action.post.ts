import { readBody } from "h3";
import { moderateForumThread } from "~/server/utils/forum";

export default defineEventHandler(async (event) => moderateForumThread(event, await readBody(event)));
