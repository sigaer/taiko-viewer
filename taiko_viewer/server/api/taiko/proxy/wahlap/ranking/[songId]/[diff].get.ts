import { getQuery } from "h3";
import { enforceTaikoOpenQuota } from "~/server/utils/taiko-open";
import { proxyTaikoWahlapRanking } from "~/server/utils/taiko-center";

export default defineEventHandler(async (event) => {
  await enforceTaikoOpenQuota(event, "taiko_proxy_wahlap_ranking", { requireDeveloperToken: true });
  const query = getQuery(event);
  return proxyTaikoWahlapRanking(event.context.params?.songId, event.context.params?.diff, query.provinceId);
});
