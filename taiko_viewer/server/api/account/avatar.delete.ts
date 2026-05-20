import { removeAvatarForUser, requireAccountUser } from "~/server/utils/account";

export default defineEventHandler(async (event) => {
  const user = await requireAccountUser(event);
  return removeAvatarForUser(user.id);
});
