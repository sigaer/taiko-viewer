import { getRouterParam, setHeader } from "h3";
import { getOwnerAnnualMyDonPath, readAnnualImage } from "~/server/services/account/annual-summary";
import { requireAccountAnnualSummaryUser } from "~/server/services/account/annual-summary/access";

export default defineEventHandler(async (event) => {
  const user = await requireAccountAnnualSummaryUser(event);
  const path = await getOwnerAnnualMyDonPath(user.id, String(getRouterParam(event, "key") || ""));
  setHeader(event, "Content-Type", "image/png");
  setHeader(event, "Cache-Control", "private, no-store");
  return readAnnualImage(path);
});
