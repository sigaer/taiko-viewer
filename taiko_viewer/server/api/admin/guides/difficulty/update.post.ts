import { readBody } from "h3";
import { withTaikoAdminToken } from "~/server/utils/admin/auth";
import { updateGuideDifficulty } from "~/server/utils/admin/guides";

export default defineEventHandler(async (event) =>
{
  const body = (await readBody(event)) || {};
  return withTaikoAdminToken(event, (token, user) => updateGuideDifficulty(token, user, body));
});
