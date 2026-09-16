import {readBody,createError} from 'h3';
import {requireBetaAdmin} from '~/server/services/annual-beta/admin';
import {getAccountDb} from '~/server/utils/account-db';
import {assertBetaOrigin} from '~/server/services/annual-beta/events';
import {recordAdminAction} from '~/server/utils/admin/audit';
export default defineEventHandler(async event=>{
 assertBetaOrigin(event);const session=await requireBetaAdmin(event);const body=await readBody(event);const db=getAccountDb();
 if(body.action==='hint'&&/^[a-f0-9-]{36}$/.test(body.id)&&[1,2,3].includes(body.level))await db.execute('UPDATE web_beta_participants SET hint_level=GREATEST(hint_level,?),hint_recorded_at=NOW() WHERE id=?',[body.level,body.id]);
 else if(body.action==='disable_invite'&&/^[a-f0-9-]{36}$/.test(body.id))await db.execute('UPDATE web_beta_invites SET disabled_at=NOW() WHERE id=?',[body.id]);
 else throw createError({statusCode:400,statusMessage:'Invalid action'});
 await recordAdminAction({actorType:'admin',actorId:String(session.user.id),actorName:session.user.username,source:'admin-web',targetType:'annual-beta',targetKey:body.id,action:'update',extra:{action:body.action,level:body.level||null}});return {ok:true};
});
