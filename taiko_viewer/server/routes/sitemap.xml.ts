import { renderSitemapXml } from "~/server/services/content/sitemap";

export default defineEventHandler(async (event) => {
  setHeader(event, "Content-Type", "application/xml; charset=utf-8");
  setHeader(event, "Cache-Control", "public, max-age=300, s-maxage=300");
  return renderSitemapXml();
});
