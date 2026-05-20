import { readAvatarMultipart, requireAccountUser, uploadAvatarForUser } from "~/server/utils/account";

export default defineEventHandler(async (event) => {
  const user = await requireAccountUser(event);
  const avatar = await readAvatarMultipart(event);
  const result = await uploadAvatarForUser(user.id, avatar);
  return { ok: true, ...result };
});
