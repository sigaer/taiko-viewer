import { sourceProxyRequest } from "~/server/services/account/source-proxy";
import { readHirobaCredentialStatus } from "~/server/services/account/hiroba-credentials";

export default defineEventHandler(async (event) => sourceProxyRequest(event,"taiko_proxy_hiroba_credentials",async()=>readHirobaCredentialStatus(event,event.context.params?.taikoId)));
