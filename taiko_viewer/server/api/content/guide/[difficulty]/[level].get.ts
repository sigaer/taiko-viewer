import { getGuidePageContent } from "~/server/services/content";
import { resolveViewerLocale } from "~/server/utils/locale";

export default defineEventHandler(async (event) => {
  const difficulty = Number(event.context.params?.difficulty || 0);
  const level = Number(event.context.params?.level || 0);
  return getGuidePageContent(difficulty, level, resolveViewerLocale(event));
});
