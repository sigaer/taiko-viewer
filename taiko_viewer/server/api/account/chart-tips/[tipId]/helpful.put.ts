import { readBody } from "h3";
import { enforceUgcWriteRateLimit, setTipHelpful } from "~/server/services/ugc";
import { requireAccountUser } from "~/server/utils/account";
import { setPrivateNoStore } from "~/server/utils/cache-policy";

export default defineEventHandler(async (event) => {
  setPrivateNoStore(event);
  const user = await requireAccountUser(event);
  enforceUgcWriteRateLimit(event, user.id, "helpful");
  const body = await readBody(event);
  return setTipHelpful(user.id, event.context.params?.tipId, body?.enabled);
});
