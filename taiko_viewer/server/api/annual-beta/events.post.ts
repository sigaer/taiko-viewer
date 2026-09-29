import { readAnnualPolicy } from '~/server/services/account/annual-summary/policy';
import {readBody,createError} from 'h3';
import {getAccountUserFromEvent} from '~/server/utils/account/auth';
import {assertBetaOrigin,betaRate,betaContext,recordBetaEvent,CLIENT_EVENTS} from '~/server/services/annual-beta/events';
export default defineEventHandler(async event=>{
 assertBetaOrigin(event);betaRate(event,'event');const body=await readBody(event);
 if(!CLIENT_EVENTS.has(body?.name))throw createError({statusCode:400,statusMessage:'Invalid event'});
 if((await readAnnualPolicy()).mode==='public')return {ok:true,skipped:true};
 const user=await getAccountUserFromEvent(event);const ctx=await betaContext(event,user?.id||null);
 await recordBetaEvent(ctx,body.name,body.metadata);return {ok:true};
});
