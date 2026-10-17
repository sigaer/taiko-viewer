import {readServerAllowlist} from '../../infrastructure/server-allowlist.ts';
type Config={myTaikoReadModelMode?:unknown;myTaikoReadModelAllowlistPath?:unknown};
export type MyTaikoAdmission={revision:string};
/** Missing, malformed or revoked policy leaves the account on the legacy path. */
export async function captureMyTaikoAdmission(userId:number|string,config:Config=useRuntimeConfig()):Promise<MyTaikoAdmission|null>{
 if(!/^[1-9][0-9]{0,19}$/.test(String(userId)))return null;
 if(config.myTaikoReadModelMode==='all')return {revision:'all-v1'};
 if(config.myTaikoReadModelMode!=='allowlist')return null;
 const policy=await readServerAllowlist(config.myTaikoReadModelAllowlistPath,'userIds',/^[1-9][0-9]{0,19}$/);
 return policy?.ids.has(String(userId))?{revision:policy.revision}:null;
}
