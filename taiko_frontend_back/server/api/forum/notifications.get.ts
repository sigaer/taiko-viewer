import { getQuery } from "h3";
import { getForumNotifications } from "~/server/utils/forum";

export default defineEventHandler(async (event) => getForumNotifications(event, getQuery(event)));
