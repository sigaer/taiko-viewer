import { getQuery } from "h3";
import { queryChartConfig } from "~/server/services/tools/chartConfig";
import { resolveViewerLocale } from "~/server/utils/locale";
import { translateServerMessage } from "~/server/utils/server-messages";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const q = String(query.q || "").trim();
  const locale = resolveViewerLocale(event);
  if (!q) {
    throw createError({
      statusCode: 400,
      statusMessage: translateServerMessage(locale, "toolsApi.chartConfig.required", undefined, "请提供查询内容，例如：16 oxxo 180 鬼10")
    });
  }
  return queryChartConfig(q, locale);
});
