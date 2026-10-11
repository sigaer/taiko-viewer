import { readBody } from "h3";
import {sourceProxyRequest} from '~/server/services/account/source-proxy';
import {runBotBindingOperation} from '~/server/services/account/bot-binding-proxy';

export default defineEventHandler(async (event) => sourceProxyRequest(event,"taiko_proxy_bind_upsert",async()=>{
  const body = await readBody(event);
  return runBotBindingOperation(event,'upsert',body||{});
}));
