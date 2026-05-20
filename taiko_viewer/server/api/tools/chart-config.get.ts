import { getQuery } from "h3";
import { queryChartConfig } from "~/server/services/tools/chartConfig";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const q = String(query.q || "").trim();
  if (!q) {
    throw createError({ statusCode: 400, statusMessage: "请提供查询内容，例如：16 oxxo 180 鬼10" });
  }
  return queryChartConfig(q);
});
