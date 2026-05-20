import { getQuery } from "h3";
import { listForumThreads } from "~/server/utils/forum";

export default defineEventHandler(async (event) => listForumThreads(event, getQuery(event)));
