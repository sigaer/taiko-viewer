import { readBody } from "h3";
import { requireTaikoAdminSession } from "~/server/utils/admin/auth";
import { createAdminSong } from "~/server/utils/admin/songs";

export default defineEventHandler(async (event) => {
  const session = await requireTaikoAdminSession(event);
  return createAdminSong(
    { id: session.user.id, username: session.user.username },
    (await readBody(event)) || {}
  );
});
