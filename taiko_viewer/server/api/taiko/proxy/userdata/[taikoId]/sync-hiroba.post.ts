import { readBody } from "h3";
import { enforceTaikoOpenQuota } from "~/server/utils/taiko-open";
import { proxyTaikoCenterHirobaSync } from "~/server/utils/taiko-center";

export default defineEventHandler(async (event) => {
  await enforceTaikoOpenQuota(event, "taiko_proxy_userdata_sync_hiroba", { requireDeveloperToken: true });
  const body = ((await readBody(event)) || {}) as Record<string, unknown>;
  return proxyTaikoCenterHirobaSync(event.context.params?.taikoId, {
    email: body.email,
    password: body.password,
    showAll: Boolean(body.showAll),
    includeImage: body.includeImage === undefined ? true : Boolean(body.includeImage)
  });
});
