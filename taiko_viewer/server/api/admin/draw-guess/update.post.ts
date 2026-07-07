import { createError, readMultipartFormData } from "h3";
import { requireTaikoAdminSession } from "~/server/utils/admin/auth";
import { updateAdminDrawGuess } from "~/server/utils/admin/draw-guess";

export default defineEventHandler(async (event) => {
  const session = await requireTaikoAdminSession(event);
  const parts = await readMultipartFormData(event);
  if (!parts?.length) {
    throw createError({ statusCode: 400, statusMessage: "未收到更新内容" });
  }
  const getField = (name: string) =>
    parts.find((item) => item.name === name)?.data?.toString("utf-8") ?? "";
  const filePart = parts.find((item) => item.name === "file" && item.data?.length);
  return updateAdminDrawGuess({
    actor: { id: session.user.id, username: session.user.username },
    recordId: getField("id"),
    payload: {
      songTitle: getField("songTitle"),
      songIds: getField("songIds"),
      uploaderQq: getField("uploaderQq"),
      uploaderNickname: getField("uploaderNickname"),
      uploaderGroupId: getField("uploaderGroupId"),
      uploaderGroupName: getField("uploaderGroupName"),
      active: getField("active"),
      guessCorrectCount: getField("guessCorrectCount"),
      guessWrongCount: getField("guessWrongCount"),
      likeCount: getField("likeCount"),
      reportCount: getField("reportCount")
    },
    file: filePart?.data
      ? {
          buffer: filePart.data,
          fileName: filePart.filename || "draw-guess.png",
          contentType: filePart.type || "image/png"
        }
      : null
  });
});
