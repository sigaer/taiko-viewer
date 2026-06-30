import { getMyDonShowcaseSettings, requireAccountUser } from "~/server/utils/account";

export default defineEventHandler(async (event) => {
  const user = await requireAccountUser(event);
  const result = await getMyDonShowcaseSettings(user.id);
  console.log("[showcase-debug] userId:", user.id, "taikoId:", result.taikoId, "hasUserdata:", result.hasUserdata, "availableTitles:", result.availableTitles.length);
  return result;
});
