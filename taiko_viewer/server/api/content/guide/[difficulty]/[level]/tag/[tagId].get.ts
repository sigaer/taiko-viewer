import { getGuideTagItemsContent } from "~/server/services/content";
import { resolveViewerLocale } from "~/server/utils/locale";

export default defineEventHandler(async (event) => {
  const difficulty = Number(event.context.params?.difficulty || 0);
  const level = Number(event.context.params?.level || 0);
  const tagId = Number(event.context.params?.tagId || 0);
  setHeader(event, "Cache-Control", "public, max-age=300, s-maxage=300, stale-while-revalidate=3600");
  appendHeader(event, "Vary", "Accept-Language");
  appendHeader(event, "Vary", "x-viewer-locale");
  return getGuideTagItemsContent(difficulty, level, tagId, resolveViewerLocale(event));
});
