import { readAnnualPolicy } from '~/server/services/account/annual-summary/policy';
import { getCookie, setHeader } from "h3";
import { getAccountUserFromEvent } from "~/server/utils/account/auth";
import { betaContext } from "~/server/services/annual-beta/events";
import { hasAccountAnnualSummaryAccess } from "~/server/services/account/annual-summary/access";
import { getAccountDb } from "~/server/utils/account-db";
import { hashBetaToken } from "~/server/services/annual-beta/core";
export default defineEventHandler(async event=>{
 setHeader(event,'Cache-Control','private, no-store');
 const user=await getAccountUserFromEvent(event);const policy=await readAnnualPolicy();
 if(policy.mode==='public')return {authenticated:!!user,entitled:!!user&&await hasAccountAnnualSummaryAccess(user.id),pending:false,participantId:null,mode:policy.mode};
 const context=await betaContext(event,user?.id||null);
 const token=getCookie(event,'annual_beta_pending')||'';
 const [pending]:any=token?await getAccountDb().execute('SELECT invite_id FROM web_beta_pending WHERE token_hash=? AND session_id=? AND expires_at>NOW() AND redeemed_by IS NULL',[hashBetaToken(token),context.sessionId]):[[]];
 return {authenticated:!!user,entitled:!!user&&await hasAccountAnnualSummaryAccess(user.id),pending:!!pending.length,participantId:context.participantId,mode:policy.mode};
});
