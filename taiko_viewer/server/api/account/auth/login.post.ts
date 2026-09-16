import { trackBetaServer } from "~/server/services/annual-beta/events";
import { readBody } from "h3";
import { loginAccount } from "~/server/utils/account";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  try {
  const result = await loginAccount(event, {
    identifier: body?.identifier,
    password: body?.password
  });
  await trackBetaServer(event,result.user.id,"auth_success");
  return { ok: true, ...result };
  } catch(error) { await trackBetaServer(event,null,"auth_failure",{reason:"login_failed"}); throw error; }
});
