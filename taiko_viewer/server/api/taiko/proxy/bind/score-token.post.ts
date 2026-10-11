import {defineEventHandler,readBody,setHeader} from 'h3';
import {sourceProxyRequest} from '../../../../services/account/source-proxy.ts';
import {issueBotScoreToken} from '../../../../services/account/bot-score-token.ts';
export default defineEventHandler(async event=>{
 setHeader(event,'Cache-Control','private, no-store');setHeader(event,'Vary','Authorization, Cookie');
 return sourceProxyRequest(event,'proxy.bind.score-token',async()=>issueBotScoreToken(event,await readBody(event)));
});
