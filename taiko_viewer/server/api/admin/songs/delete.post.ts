import { readBody } from "h3";
import { requireTaikoAdminSession } from "~/server/utils/admin/auth";
import { deleteAdminSong } from "~/server/utils/admin/songs";

export default defineEventHandler(async (event) => {
  const session = await requireTaikoAdminSession(event);
  const body = (await readBody(event)) || {};
  return deleteAdminSong({ id: session.user.id, username: session.user.username }, body.songId);
});
