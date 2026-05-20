import { getHomeContent } from "~/server/services/content";

export default defineEventHandler(async () => getHomeContent());
