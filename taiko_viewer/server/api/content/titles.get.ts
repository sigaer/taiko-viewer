import { getTitlesPageContent } from "~/server/services/content";

export default defineEventHandler(async (event) => {
  setResponseHeader(event, "cache-control", "no-store");
  return getTitlesPageContent();
});
