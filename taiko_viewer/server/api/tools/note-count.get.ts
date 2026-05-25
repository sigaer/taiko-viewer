import { getQuery } from "h3";
import { queryNoteCount } from "~/server/services/tools/noteCount";
import { resolveViewerLocale } from "~/server/utils/locale";
import { translateServerMessage } from "~/server/utils/server-messages";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const count = Number(query.count);
  const locale = resolveViewerLocale(event);
  if (!Number.isFinite(count)) {
    throw createError({
      statusCode: 400,
      statusMessage: translateServerMessage(locale, "toolsApi.noteCount.required", undefined, "请提供物量数值")
    });
  }
  return queryNoteCount(count, locale);
});
