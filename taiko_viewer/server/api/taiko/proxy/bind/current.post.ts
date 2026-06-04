import { readBody } from "h3";
import { enforceTaikoOpenQuota } from "~/server/utils/taiko-open";
import { proxyTaikoCenterBindSwitchCurrent } from "~/server/utils/taiko-center";

export default defineEventHandler(async (event) => {
  await enforceTaikoOpenQuota(event, "taiko_proxy_bind_switch_current");
  const body = await readBody(event);
  return proxyTaikoCenterBindSwitchCurrent(body?.identityKey, body?.slot);
});
