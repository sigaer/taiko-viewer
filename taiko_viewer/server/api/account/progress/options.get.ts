import { requireAccountUser } from "~/server/utils/account";
import { getProgressOptions } from "~/server/services/account/progress";

export default defineEventHandler(async (event) => {
  await requireAccountUser(event);
  return getProgressOptions();
});
