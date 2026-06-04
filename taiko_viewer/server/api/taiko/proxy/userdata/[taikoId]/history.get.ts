import { enforceTaikoOpenQuota } from "~/server/utils/taiko-open";
import { proxyTaikoCenterUserdataHistory } from "~/server/utils/taiko-center";

export default defineEventHandler(async (event) => {
  await enforceTaikoOpenQuota(event, "taiko_proxy_userdata_history");
  return proxyTaikoCenterUserdataHistory(event.context.params?.taikoId);
});
