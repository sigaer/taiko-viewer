import { readBody } from "h3";
import { deleteManualScore, requireAccountUser } from "~/server/utils/account";

export default defineEventHandler(async (event) => {
  const user = await requireAccountUser(event);
  const body = await readBody(event);
  return deleteManualScore(
    { kind: "viewer", userId: user.id },
    body?.taikoId,
    body?.songNo,
    body?.level,
    body?.confirmed
  );
});
