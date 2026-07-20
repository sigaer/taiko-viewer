import { getQuery } from "h3";
import { requireTaikoAdminSession } from "~/server/utils/admin/auth";
import { listAdminCustomTitles } from "~/server/utils/admin/custom-titles";

export default defineEventHandler(async (event) => {
  await requireTaikoAdminSession(event);
  return listAdminCustomTitles(getQuery(event));
});
