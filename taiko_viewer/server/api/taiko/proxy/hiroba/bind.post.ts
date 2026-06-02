import { readBody } from "h3";
import { enforceTaikoOpenQuota } from "~/server/utils/taiko-open";
import { proxyTaikoCenterHirobaBind } from "~/server/utils/taiko-center";

export default defineEventHandler(async (event) => {
  await enforceTaikoOpenQuota(event, "taiko_proxy_hiroba_bind", { requireDeveloperToken: true });
  const body = ((await readBody(event)) || {}) as Record<string, unknown>;
  return proxyTaikoCenterHirobaBind({
    email: body.email,
    password: body.password,
    targetTaikoNo: body.targetTaikoNo,
    configuredByQq: body.configuredByQq
  });
});
