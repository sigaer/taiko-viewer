import { readBody } from "h3";
import { importAccountSongs, requireAccountUser } from "~/server/utils/account";

export default defineEventHandler(async (event) => {
  const user = await requireAccountUser(event);
  const body = await readBody(event);
  return importAccountSongs(user.id, body);
});
