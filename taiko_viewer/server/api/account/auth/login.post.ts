import { readBody } from "h3";
import { loginAccount } from "~/server/utils/account";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  try {
  const result = await loginAccount(event, {
    identifier: body?.identifier,
    password: body?.password
  });

  return { ok: true, ...result };
  } catch(error) {  throw error; }
});
