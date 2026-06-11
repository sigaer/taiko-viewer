import { readBody } from "h3";
import { deleteAdminCover } from "~/server/utils/admin/covers";
import { requireTaikoAdminSession } from "~/server/utils/admin/auth";

export default defineEventHandler(async (event) => {
  const session = await requireTaikoAdminSession(event);
  const body = (await readBody(event)) || {};
  return deleteAdminCover({ id: session.user.id, username: session.user.username }, body.songId);
});
