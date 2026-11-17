import { readBody } from "h3";
import { importKinokoScoreHistory,requireAccountUser } from "~/server/utils/account";
import { getCurrentBindingRow,userdataFileExists,getUserdataPath } from "~/server/internal/account/shared";
import { stat } from "node:fs/promises";
export default defineEventHandler(async event=>{
 const user=await requireAccountUser(event);const start=Date.now();
 try {const result=await importKinokoScoreHistory(event,await readBody(event));const binding=await getCurrentBindingRow(user.id);
 const ready=binding&&await userdataFileExists(binding.taiko_id);const updated=ready?await stat(getUserdataPath(binding!.taiko_id)):null;
 return result;
 }catch(error){throw error;}
});
