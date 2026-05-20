import { getGuideTagItemsContent } from "~/server/services/content";

export default defineEventHandler(async (event) => {
  const difficulty = Number(event.context.params?.difficulty || 0);
  const level = Number(event.context.params?.level || 0);
  const tagId = Number(event.context.params?.tagId || 0);
  return getGuideTagItemsContent(difficulty, level, tagId);
});
