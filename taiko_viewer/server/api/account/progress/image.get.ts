import { getQuery, setHeader } from "h3";
import { requireAccountUser } from "~/server/utils/account";
import { getProgressImageBuffer } from "~/server/services/account/progress";

export default defineEventHandler(async (event) => {
  const user = await requireAccountUser(event);
  const query = getQuery(event);
  const buffer = await getProgressImageBuffer(user.id, {
    kind: String(query.kind || ""),
    version: String(query.version || ""),
    grade: String(query.grade || ""),
    constant: String(query.constant || ""),
    mode: String(query.mode || ""),
    star: Number(query.star),
    name: String(query.name || ""),
    page: Number(query.page)
  });
  setHeader(event, "Content-Type", "image/png");
  setHeader(event, "Cache-Control", "no-store");
  setHeader(event, "Content-Disposition", "inline; filename=taiko-progress.png");
  return buffer;
});
