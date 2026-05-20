import { getForumHome } from "~/server/utils/forum";

export default defineEventHandler(async (event) => getForumHome(event));
