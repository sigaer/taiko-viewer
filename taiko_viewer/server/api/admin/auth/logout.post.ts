import { logoutTaikoAdmin } from "~/server/utils/admin/auth";

export default defineEventHandler(async (event) => logoutTaikoAdmin(event));
