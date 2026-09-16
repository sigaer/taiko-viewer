import { getCookie,deleteCookie,createError } from 'h3';
import { requireAccountUser } from '~/server/utils/account/auth';
import { getAccountDb } from '~/server/utils/account-db';
import { redeemBetaInvite,BetaError } from '~/server/services/annual-beta/core';
import { assertBetaOrigin,betaRate,betaContext,recordBetaEventSafely } from '~/server/services/annual-beta/events';
export default defineEventHandler(async event=>{
 assertBetaOrigin(event);betaRate(event,'invite');const user=await requireAccountUser(event);const ctx=await betaContext(event,user.id);
 try{
  const result=await redeemBetaInvite(getAccountDb(),getCookie(event,'annual_beta_pending')||'',ctx.sessionId,user.id);
  deleteCookie(event,'annual_beta_pending',{path:'/'});
  await recordBetaEventSafely({...ctx,inviteId:result.inviteId},'beta_invite_redeemed',{},'redeemed:'+user.id);
  return {ok:true,entitled:true};
 }catch(error){if(error instanceof BetaError)throw createError({statusCode:error.status,statusMessage:'邀请码兑换失败，请重新验证',data:{code:error.code}});throw error;}
});
