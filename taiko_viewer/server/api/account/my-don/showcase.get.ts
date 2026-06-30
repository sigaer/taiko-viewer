import { getMyDonShowcaseSettings, requireAccountUser } from "~/server/utils/account";

export default defineEventHandler(async (event) => {
  const user = await requireAccountUser(event);
  return getMyDonShowcaseSettings(user.id);
});
