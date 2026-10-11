import { readBody } from "h3";
import { sourceProxyRequest } from "~/server/services/account/source-proxy";
import { bindHirobaCredentials } from "~/server/services/account/hiroba-credentials";

export default defineEventHandler(async (event) => sourceProxyRequest(event,"taiko_proxy_hiroba_bind",async()=>bindHirobaCredentials(event,await readBody(event))));
