import { getQuery } from "h3";
import { enforceTaikoOpenQuota } from "~/server/utils/taiko-open";
import { proxyTaikoCenterBindLookup } from "~/server/utils/taiko-center";

export default defineEventHandler(async (event) => {
  await enforceTaikoOpenQuota(event, "taiko_proxy_bind_lookup");
  const query = getQuery(event);
  return proxyTaikoCenterBindLookup(query.identityKey);
});
