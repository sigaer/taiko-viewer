import { readBody } from "h3";
import { enforceTaikoOpenQuota } from "~/server/utils/taiko-open";
import { proxyTaikoCenterUserdataUpdate } from "~/server/utils/taiko-center";

export default defineEventHandler(async (event) => {
  await enforceTaikoOpenQuota(event, "taiko_proxy_userdata_update");
  const body = ((await readBody(event)) || {}) as Record<string, unknown>;
  return proxyTaikoCenterUserdataUpdate(event.context.params?.taikoId, {
    showAll: Boolean(body.showAll),
    includeImage: body.includeImage === undefined ? true : Boolean(body.includeImage)
  });
});
