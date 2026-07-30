import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { sendStream, setHeader } from "h3";
import { getContentRuntimePaths } from "~/server/services/content/runtime";

export default defineEventHandler(async (event) => {
  const { repoRoot } = getContentRuntimePaths();
  const iconPath = resolve(repoRoot, "assets", "icons", "other", "don.ico");

  try {
    await access(iconPath);
    const iconStat = await stat(iconPath);
    setHeader(event, "Content-Type", "image/x-icon");
    setHeader(event, "Content-Length", String(iconStat.size));
    setHeader(event, "Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
    setHeader(event, "Last-Modified", iconStat.mtime.toUTCString());
    return sendStream(event, createReadStream(iconPath));
  } catch {
    throw createError({
      statusCode: 404,
      statusMessage: "Don icon not found",
      message: "小咚图标不存在"
    });
  }
});
