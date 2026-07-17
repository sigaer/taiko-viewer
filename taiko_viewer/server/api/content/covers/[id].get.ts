import { createError, sendRedirect, setHeader } from "h3";
import { resolveSongCoverAsset } from "~/server/services/content";

export default defineEventHandler(async (event) => {
  setHeader(event, "Cache-Control", "no-store");
  const songId = Number(getRouterParam(event, "id") || 0);
  if (!Number.isInteger(songId) || songId <= 0) {
    throw createError({ statusCode: 400, statusMessage: "歌曲 ID 无效" });
  }

  try {
    const cover = await resolveSongCoverAsset(songId);
    if (!cover) throw createError({ statusCode: 404, statusMessage: "封面不存在" });
    return sendRedirect(event, cover.redirectUrl, 302);
  } catch (error: any) {
    if (Number(error?.statusCode || error?.status || 0) === 404 || error?.code === "ENOENT") {
      throw createError({ statusCode: 404, statusMessage: "封面不存在" });
    }
    throw error;
  }
});
