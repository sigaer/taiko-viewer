import { setHeader } from "h3";
import { requireAccountUser } from "~/server/utils/account";
import { getWordCloudImageBuffer } from "~/server/services/account/charts";

export default defineEventHandler(async (event) => {
  const user = await requireAccountUser(event);
  const buffer = await getWordCloudImageBuffer(user.id);
  setHeader(event, "Content-Type", "image/png");
  setHeader(event, "Cache-Control", "no-store");
  return buffer;
});
