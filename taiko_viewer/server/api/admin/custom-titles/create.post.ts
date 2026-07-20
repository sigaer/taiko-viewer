import { readBody } from "h3";
import { requireTaikoAdminSession } from "~/server/utils/admin/auth";
import { createAdminCustomTitle } from "~/server/utils/admin/custom-titles";

export default defineEventHandler(async (event) => {
  const session = await requireTaikoAdminSession(event);
  return createAdminCustomTitle(
    { id: session.user.id, username: session.user.username },
    (await readBody(event)) || {}
  );
});
