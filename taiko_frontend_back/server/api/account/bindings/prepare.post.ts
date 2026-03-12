import { readBody } from "h3";
import { requireAccountUser, startBindingVerification } from "~/server/utils/account";

export default defineEventHandler(async (event) => {
  const user = await requireAccountUser(event);
  const body = await readBody(event);
  const result = await startBindingVerification(user.id, body?.taikoId);
  return { ok: true, ...result };
});
