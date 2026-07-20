import { readBody } from "h3";
import { requireTaikoAdminSession } from "~/server/utils/admin/auth";
import { updateAdminCustomTitle } from "~/server/utils/admin/custom-titles";

export default defineEventHandler(async (event) => {
  const session = await requireTaikoAdminSession(event);
  return updateAdminCustomTitle(
    { id: session.user.id, username: session.user.username },
    (await readBody(event)) || {}
  );
});
