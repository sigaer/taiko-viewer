import { readAuthorizedSourceHistory, sourceProxyRequest } from "~/server/services/account/source-proxy";
import { privateSourceResponse } from "~/server/infrastructure/account/private-source-response";

export default defineEventHandler(async (event) => sourceProxyRequest(event, "taiko_proxy_userdata_history", async () => {
  return privateSourceResponse(event, 'history', () => readAuthorizedSourceHistory(event, event.context.params?.taikoId));
}));
