import { getQuery } from "h3";
import { proxyBilibiliImage } from "~/server/services/bilibili";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const rawUrl = String(query.url || "").trim();
  if (!rawUrl) {
    throw createError({ statusCode: 400, statusMessage: "url is required" });
  }

  const { data, contentType } = await proxyBilibiliImage(rawUrl);
  setResponseHeader(event, "Content-Type", contentType);
  setResponseHeader(event, "Cache-Control", "public, max-age=3600");
  return data;
});
