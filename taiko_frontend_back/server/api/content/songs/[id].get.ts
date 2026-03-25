import { getSongDetailPayload } from "~/server/services/content";

export default defineEventHandler(async (event) => {
  const songId = Number(event.context.params?.id || 0);
  if (!Number.isInteger(songId) || songId <= 0) {
    throw createError({ statusCode: 400, statusMessage: "歌曲 ID 无效" });
  }
  return getSongDetailPayload(songId);
});
