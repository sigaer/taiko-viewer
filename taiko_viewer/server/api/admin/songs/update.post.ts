import { readBody } from "h3";
import { requireTaikoAdminSession } from "~/server/utils/admin/auth";
import { updateAdminSong } from "~/server/utils/admin/songs";

export default defineEventHandler(async (event) => {
  const session = await requireTaikoAdminSession(event);
  return updateAdminSong(
    { id: session.user.id, username: session.user.username },
    (await readBody(event)) || {}
  );
});
