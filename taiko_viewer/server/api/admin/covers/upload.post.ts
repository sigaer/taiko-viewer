import { createError, readMultipartFormData } from "h3";
import { uploadAdminCover } from "~/server/utils/admin/covers";
import { requireTaikoAdminSession } from "~/server/utils/admin/auth";

export default defineEventHandler(async (event) => {
  const session = await requireTaikoAdminSession(event);
  const parts = await readMultipartFormData(event);
  if (!parts?.length) {
    throw createError({ statusCode: 400, statusMessage: "未收到上传内容" });
  }
  const songIdPart = parts.find((item) => item.name === "songId");
  const replacePart = parts.find((item) => item.name === "replace");
  const filePart = parts.find((item) => item.name === "file" && item.data);
  if (!songIdPart?.data || !filePart?.data) {
    throw createError({ statusCode: 400, statusMessage: "请提供 songId 和封面文件" });
  }
  return uploadAdminCover({
    actor: { id: session.user.id, username: session.user.username },
    songId: Number(songIdPart.data.toString("utf-8")),
    fileName: filePart.filename || "cover.png",
    contentType: filePart.type || "",
    buffer: filePart.data,
    replace: String(replacePart?.data?.toString("utf-8") || "") === "1"
  });
});
