import { renderRobotsTxt } from "~/server/services/content/sitemap";

export default defineEventHandler((event) => {
  setHeader(event, "Content-Type", "text/plain; charset=utf-8");
  setHeader(event, "Cache-Control", "public, max-age=300, s-maxage=300");
  return renderRobotsTxt();
});
