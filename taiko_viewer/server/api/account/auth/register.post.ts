import {trackBetaServer} from "~/server/services/annual-beta/events";
import { readBody } from "h3";
import { registerAccount } from "~/server/utils/account";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  try {
  const result = await registerAccount({
    username: body?.username,
    email: body?.email,
    password: body?.password,
    code: body?.code
  });
  return { ok: true, userId: result.userId };
  }catch(error){await trackBetaServer(event,null,"auth_failure",{reason:"register_failed"});throw error;}
});
