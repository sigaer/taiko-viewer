import { readBody } from "h3";
import { deleteAdminAlias } from "~/server/utils/admin/aliases";
import { requireTaikoAdminSession } from "~/server/utils/admin/auth";

export default defineEventHandler(async (event) => {
  const session = await requireTaikoAdminSession(event);
  return deleteAdminAlias(
    { id: session.user.id, username: session.user.username },
    (await readBody(event)) || {}
  );
});
