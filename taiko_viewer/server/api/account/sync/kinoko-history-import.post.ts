import { readBody } from "h3";
import { importKinokoScoreHistory,requireAccountUser } from "~/server/utils/account";
import { trackBetaServer } from "~/server/services/annual-beta/events";
import { getCurrentBindingRow,userdataFileExists,getUserdataPath } from "~/server/internal/account/shared";
import { stat } from "node:fs/promises";
export default defineEventHandler(async event=>{
 const user=await requireAccountUser(event);const start=Date.now();await trackBetaServer(event,user.id,'data_sync_start');
 try {const result=await importKinokoScoreHistory(event,await readBody(event));const binding=await getCurrentBindingRow(user.id);
 const ready=binding&&await userdataFileExists(binding.taiko_id);const updated=ready?await stat(getUserdataPath(binding!.taiko_id)):null;
 await trackBetaServer(event,user.id,result.log?.status==='success'&&ready?'data_sync_success':'data_sync_failure',{sync_duration_ms:Date.now()-start,data_updated_at:updated?.mtime.toISOString(),reason:result.log?.status});return result;
 }catch(error){await trackBetaServer(event,user.id,'data_sync_failure',{sync_duration_ms:Date.now()-start,reason:'sync_failed'});throw error;}
});
