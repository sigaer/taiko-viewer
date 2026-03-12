import { readBody } from "h3";
import { requireAccountUser, switchCurrentBinding } from "~/server/utils/account";

export default defineEventHandler(async (event) => {
  const user = await requireAccountUser(event);
  const body = await readBody(event);
  await switchCurrentBinding(user.id, body?.bindingId);
  return { ok: true };
});
