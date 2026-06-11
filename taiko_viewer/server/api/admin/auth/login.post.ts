import { readBody } from "h3";
import { loginTaikoAdmin } from "~/server/utils/admin/auth";

export default defineEventHandler(async (event) => {
  return loginTaikoAdmin(event, await readBody(event));
});
