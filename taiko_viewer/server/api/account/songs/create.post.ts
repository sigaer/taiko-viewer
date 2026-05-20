import { readBody } from "h3";
import { createAccountSong, requireAccountUser } from "~/server/utils/account";

export default defineEventHandler(async (event) => {
  const user = await requireAccountUser(event);
  const body = await readBody(event);
  const item = await createAccountSong(user.id, {
    songNo: body?.songNo,
    level: body?.level,
    values: body?.values || {},
    title: body?.title,
    titleJp: body?.titleJp
  });
  return { ok: true, item };
});
