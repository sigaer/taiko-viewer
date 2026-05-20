import { getQuery } from "h3";
import { queryNoteCount } from "~/server/services/tools/noteCount";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const count = Number(query.count);
  if (!Number.isFinite(count)) {
    throw createError({ statusCode: 400, statusMessage: "请提供物量数值" });
  }
  return queryNoteCount(count);
});
