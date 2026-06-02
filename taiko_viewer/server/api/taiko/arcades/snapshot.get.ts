import { enforceTaikoOpenQuota } from "~/server/utils/taiko-open";
import { proxyTaikoArcadeSnapshot } from "~/server/utils/taiko-center";

export default defineEventHandler(async (event) => {
  await enforceTaikoOpenQuota(event, "taiko_arcades_snapshot");
  return proxyTaikoArcadeSnapshot();
});
