import { createReadStream } from "node:fs";
import { getRouterParam, sendStream, setHeader } from "h3";
import { requireTaikoAdminSession } from "~/server/utils/admin/auth";
import { resolveAdminDrawGuessImage } from "~/server/utils/admin/draw-guess";

export default defineEventHandler(async (event) => {
  await requireTaikoAdminSession(event);
  const image = await resolveAdminDrawGuessImage(getRouterParam(event, "id"));
  setHeader(event, "Content-Type", image.contentType);
  setHeader(event, "Cache-Control", "private, max-age=60");
  return sendStream(event, createReadStream(image.filePath));
});
