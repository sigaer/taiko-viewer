import { readBody } from "h3";
import { enforceTaikoOpenQuota } from "~/server/utils/taiko-open";
import { proxyTaikoCenterBindUpsert } from "~/server/utils/taiko-center";

export default defineEventHandler(async (event) => {
  await enforceTaikoOpenQuota(event, "taiko_proxy_bind_upsert");
  const body = await readBody(event);
  return proxyTaikoCenterBindUpsert(body?.identityKey, body?.taikoId, {
    visible: body?.visible,
    source: body?.source
  });
});
