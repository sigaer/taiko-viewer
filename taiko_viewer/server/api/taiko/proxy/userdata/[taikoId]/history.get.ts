import { readAuthorizedSourceHistory, sourceProxyRequest } from "~/server/services/account/source-proxy";

export default defineEventHandler(async (event) => sourceProxyRequest(event, "taiko_proxy_userdata_history", async () => {
  return readAuthorizedSourceHistory(event, event.context.params?.taikoId);
}));
