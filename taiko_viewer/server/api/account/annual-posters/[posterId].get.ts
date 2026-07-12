import { getRouterParam, setHeader } from "h3";
import { getOwnerAnnualPosterPath, readAnnualImage } from "~/server/services/account/annual-summary";
import { requireAccountUser } from "~/server/utils/account";

export default defineEventHandler(async (event) => {
  const user = await requireAccountUser(event);
  const posterId = String(getRouterParam(event, "posterId") || "");
  const path = await getOwnerAnnualPosterPath(user.id, posterId);
  setHeader(event, "Content-Type", "image/png");
  setHeader(event, "Cache-Control", "private, no-store");
  setHeader(event, "Content-Disposition", `inline; filename="annual-${posterId}.png"`);
  return readAnnualImage(path);
});
