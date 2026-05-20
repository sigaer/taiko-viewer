import { readBody } from "h3";
import { resetPassword } from "~/server/utils/account";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  await resetPassword({
    email: body?.email,
    code: body?.code,
    password: body?.password
  });
  return { ok: true };
});
