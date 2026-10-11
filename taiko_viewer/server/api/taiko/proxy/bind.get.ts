import { getQuery } from "h3";
import {sourceProxyRequest} from '~/server/services/account/source-proxy';
import {runBotBindingOperation} from '~/server/services/account/bot-binding-proxy';

export default defineEventHandler(async (event) => sourceProxyRequest(event,"taiko_proxy_bind_lookup",async()=>{
  const query = getQuery(event);
  return runBotBindingOperation(event,'read',{identityKey:query.identityKey});
}));
