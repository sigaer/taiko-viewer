import { setHeader } from "h3";
import { getMyDonImageBuffer, requireAccountUser } from "~/server/utils/account";

export default defineEventHandler(async (event) => {
  const user = await requireAccountUser(event);
  const buffer = await getMyDonImageBuffer(user.id);
  setHeader(event, "Content-Type", "image/png");
  setHeader(event, "Cache-Control", "no-store");
  return buffer;
});
