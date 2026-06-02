import { enforceTaikoOpenQuota } from "~/server/utils/taiko-open";
import { proxyTaikoCenterHirobaCredentialStatus } from "~/server/utils/taiko-center";

export default defineEventHandler(async (event) => {
  await enforceTaikoOpenQuota(event, "taiko_proxy_hiroba_credentials", { requireDeveloperToken: true });
  return proxyTaikoCenterHirobaCredentialStatus(event.context.params?.taikoId);
});
