import { getHomeContent } from "~/server/services/content";

export default defineEventHandler(async (event) => {
  setHeader(event, "Cache-Control", "public, max-age=60, s-maxage=60, stale-while-revalidate=300");
  return getHomeContent();
});
