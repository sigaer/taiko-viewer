import { enforceTaikoOpenQuota } from "~/server/utils/taiko-open";
import { proxyTaikoWahlapPlayer } from "~/server/utils/taiko-center";

export default defineEventHandler(async (event) => {
  await enforceTaikoOpenQuota(event, "taiko_proxy_wahlap_player", { requireDeveloperToken: true });
  return proxyTaikoWahlapPlayer(event.context.params?.taikoId);
});
