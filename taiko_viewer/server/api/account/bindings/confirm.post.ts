import { trackBetaServer } from "~/server/services/annual-beta/events";
import { readBody } from "h3";
import { confirmBindingVerification, requireAccountUser } from "~/server/utils/account";

export default defineEventHandler(async (event) => {
  const user = await requireAccountUser(event);
  const body = await readBody(event);
  try {
  await confirmBindingVerification(user.id, body?.taikoId);
  await trackBetaServer(event,user.id,"binding_success");
  return { ok: true };
  } catch(error) { await trackBetaServer(event,user.id,"binding_failure",{reason:"confirm_failed"}); throw error; }
});
