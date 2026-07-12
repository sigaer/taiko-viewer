import { getRouterParam, setHeader } from "h3";
import { getOwnerAnnualMyDonPath, readAnnualImage } from "~/server/services/account/annual-summary";
import { requireAccountUser } from "~/server/utils/account";

export default defineEventHandler(async (event) => {
  const user = await requireAccountUser(event);
  const path = await getOwnerAnnualMyDonPath(user.id, String(getRouterParam(event, "key") || ""));
  setHeader(event, "Content-Type", "image/png");
  setHeader(event, "Cache-Control", "private, no-store");
  return readAnnualImage(path);
});
