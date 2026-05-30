import { buildTaikoOpenManifest, enforceTaikoOpenQuota } from "~/server/utils/taiko-open";

export default defineEventHandler(async (event) => {
  await enforceTaikoOpenQuota(event, "taiko_manifest");
  return buildTaikoOpenManifest(event);
});
