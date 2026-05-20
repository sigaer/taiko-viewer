import { readBody } from "h3";
import { removeBinding, requireAccountUser } from "~/server/utils/account";

export default defineEventHandler(async (event) => {
  const user = await requireAccountUser(event);
  const body = await readBody(event);
  return removeBinding(user.id, body?.bindingId, body?.force);
});
