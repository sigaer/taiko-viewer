import { readBody } from "h3";
import { updateAuthorizedSource, sourceProxyRequest } from "~/server/services/account/source-proxy";

export default defineEventHandler(async (event) => sourceProxyRequest(event, "taiko_proxy_userdata_update", async () => {
  const body = ((await readBody(event)) || {}) as Record<string, unknown>;
  return updateAuthorizedSource(event, event.context.params?.taikoId, 'wahlap', {
    showAll: Boolean(body.showAll),
    includeImage: body.includeImage === undefined ? true : Boolean(body.includeImage)
  });
}));
