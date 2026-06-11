import { requireTaikoAdminSession } from "~/server/utils/admin/auth";

export default defineEventHandler(async (event) => {
  const session = await requireTaikoAdminSession(event);
  return {
    authenticated: true,
    user: session.user
  };
});
