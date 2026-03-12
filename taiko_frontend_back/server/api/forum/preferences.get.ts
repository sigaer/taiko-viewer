import { getForumPreferences } from "~/server/utils/forum";

export default defineEventHandler(async (event) => getForumPreferences(event));
