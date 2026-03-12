import { readBody } from "h3";
import { markForumNotificationsRead } from "~/server/utils/forum";

export default defineEventHandler(async (event) => markForumNotificationsRead(event, await readBody(event)));
