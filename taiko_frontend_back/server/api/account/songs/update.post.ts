import { readBody } from "h3";
import { requireAccountUser, updateAccountSong } from "~/server/utils/account";

export default defineEventHandler(async (event) => {
  const user = await requireAccountUser(event);
  const body = await readBody(event);
  const item = await updateAccountSong(user.id, {
    songNo: body?.songNo,
    level: body?.level,
    values: body?.values || {}
  });
  return { ok: true, item };
});
