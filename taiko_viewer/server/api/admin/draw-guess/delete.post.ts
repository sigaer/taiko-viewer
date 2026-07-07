import { readBody } from "h3";
import { requireTaikoAdminSession } from "~/server/utils/admin/auth";
import { deleteAdminDrawGuess } from "~/server/utils/admin/draw-guess";

export default defineEventHandler(async (event) => {
  const session = await requireTaikoAdminSession(event);
  const body = (await readBody(event)) || {};
  return deleteAdminDrawGuess({ id: session.user.id, username: session.user.username }, body.id);
});
