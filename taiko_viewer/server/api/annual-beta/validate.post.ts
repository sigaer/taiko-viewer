import { readBody,setCookie,createError } from 'h3';
import { getAccountUserFromEvent } from '~/server/utils/account/auth';
import { getSecureCookieFlag } from '~/server/internal/account/shared';
import { getAccountDb } from '~/server/utils/account-db';
import { validateBetaInvite,BetaError } from '~/server/services/annual-beta/core';
import { assertBetaOrigin,betaRate,betaContext,recordBetaEventSafely } from '~/server/services/annual-beta/events';
export default defineEventHandler(async event=>{
 assertBetaOrigin(event);betaRate(event,'invite');const user=await getAccountUserFromEvent(event);const ctx=await betaContext(event,user?.id||null);const body=await readBody(event);
 try{
  const result=await validateBetaInvite(getAccountDb(),body?.code,ctx.sessionId);
  setCookie(event,'annual_beta_pending',result.token,{httpOnly:true,secure:getSecureCookieFlag(event),sameSite:'lax',path:'/',maxAge:1800});
  await recordBetaEventSafely({...ctx,inviteId:result.inviteId},'beta_invite_validated');
  return {ok:true,authenticated:!!user};
 }catch(error){
  if(error instanceof BetaError){await recordBetaEventSafely(ctx,'beta_invite_validation_failed',{reason:error.code});throw createError({statusCode:error.status,statusMessage:'邀请码不可用，请检查后重试',data:{code:error.code}});}
  throw error;
 }
});
