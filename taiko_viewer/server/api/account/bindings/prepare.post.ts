import { trackBetaServer } from "~/server/services/annual-beta/events";
import { readBody } from "h3";
import { requireAccountUser, startBindingVerification } from "~/server/utils/account";

export default defineEventHandler(async (event) => {
  const user = await requireAccountUser(event);
  const body = await readBody(event);
  try {
  const result = await startBindingVerification(user.id, body?.taikoId);
  await trackBetaServer(event,user.id,"binding_pending");
  return { ok: true, ...result };
  } catch(error) { await trackBetaServer(event,user.id,"binding_failure",{reason:"prepare_failed"}); throw error; }
});
