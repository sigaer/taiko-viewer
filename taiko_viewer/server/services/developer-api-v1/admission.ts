import {readServerAllowlist} from '../../infrastructure/server-allowlist';
/** This deployment admits selected clients in addition to, never instead of,
 * the approved application, active token and live per-resource consent proof.
 */
export async function developerClientAdmitted(clientId:string){
 const policy=await readServerAllowlist(useRuntimeConfig().developerApiClientAllowlistPath,'clientIds',/^clt_[a-f0-9]{32}$/);
 return policy?.ids.has(clientId)===true;
}
