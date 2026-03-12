import { readBody } from "h3";
import { sendPasswordResetCode, sendRegisterCode } from "~/server/utils/account";

export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: string; purpose?: string }>(event);
  const purpose = String(body?.purpose || "register");
  if (purpose === "reset") {
    return sendPasswordResetCode(body?.email);
  }
  return sendRegisterCode(body?.email);
});
