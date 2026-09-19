// Synthetic fixtures only; mimics the audited writer's ujson envelope.
import {createHash} from 'node:crypto';
export function authoritativeFixture(payload,account,at=new Date()) {
 const local=new Date(at.getTime()+8*3600000).toISOString();
 const stamp=local.slice(0,10).replaceAll('-','')+'_'+local.slice(11,19).replaceAll(':','')+'_'+local.slice(20,23)+'000';
 const result={...payload,profile:{...payload.profile,userid:account},_meta:{full:true,source:'wahlap',source_account:account,merge_topology:[],schema_version:2,ts:stamp,synced_at:local.slice(0,19)}};
 const canonical=value=>value===null||typeof value!=='object'?JSON.stringify(value).replace(/\//g,'\\/'):Array.isArray(value)?`[${value.map(canonical).join(',')}]`:`{${Object.keys(value).sort().map(k=>`${canonical(k)}:${canonical(value[k])}`).join(',')}}`;
 result._meta.content_sha256=createHash('sha256').update(canonical(result)).digest('hex');return result;
}
