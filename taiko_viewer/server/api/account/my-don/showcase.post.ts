import { readBody } from "h3";
import { requireAccountUser, updateMyDonShowcaseSettings } from "~/server/utils/account";

export default defineEventHandler(async (event) => {
  const user = await requireAccountUser(event);
  const body = await readBody<{ titleNames?: unknown }>(event);
  return updateMyDonShowcaseSettings(user.id, body?.titleNames);
});
