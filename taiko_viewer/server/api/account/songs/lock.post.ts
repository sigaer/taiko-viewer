import { readBody } from "h3";
import { requireAccountUser, setAccountSongLock } from "~/server/utils/account";

export default defineEventHandler(async (event) => {
  const user = await requireAccountUser(event);
  const body = await readBody(event);
  return setAccountSongLock(user.id, {
    songNo: body?.songNo,
    level: body?.level,
    locked: body?.locked
  });
});
