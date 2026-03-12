import { getForumMeSummary } from "~/server/utils/forum";

export default defineEventHandler(async (event) => getForumMeSummary(event));
