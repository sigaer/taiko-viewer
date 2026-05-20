import { getProfileResponse } from "~/server/utils/account";

export default defineEventHandler(async (event) => {
  const profile = await getProfileResponse(event);
  return {
    bindings: profile.bindings,
    currentBinding: profile.currentBinding,
    pendingBinding: profile.pendingBinding
  };
});
