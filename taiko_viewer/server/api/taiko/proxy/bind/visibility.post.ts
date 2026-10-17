import {readBody,defineEventHandler} from 'h3';
import {sourceProxyRequest} from '~/server/services/account/source-proxy';
import {runBotBindingOperation} from '~/server/services/account/bot-binding-proxy';

export default defineEventHandler(event=>sourceProxyRequest(event,'taiko_proxy_bind_visibility',async()=>
 runBotBindingOperation(event,'visibility',(await readBody(event))||{})));
