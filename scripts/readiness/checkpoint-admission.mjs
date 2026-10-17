// Offline recovery-tool admission only. No filesystem/SQL/network mutation.
// The caller must obtain trustedManifestSha256 from an independent committed
// checkpoint ledger. Hashing an arbitrary supplied manifest is not trust.
import {createHash} from 'node:crypto';
const sha = value => createHash('sha256').update(value).digest('hex');
const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const identity = value => value && typeof value.source === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value.source)
 && Number.isSafeInteger(value.sequence) && value.sequence > 0 && /^[a-f0-9]{32}$/.test(value.commitId);
const normalizedIdentity = value => ({source:value.source,sequence:value.sequence,commitId:value.commitId});
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
function inventory(value) {
 if (!value || Array.isArray(value) || typeof value !== 'object') return null;
 const entries = Object.entries(value);
 if (!entries.length || entries.length > 10000) return null;
 if (entries.some(([path,hash]) => !path || path.length>1024 || path.startsWith('/') || path.split('/').some(x=>x==='..'||x==='.') || !digest(hash))) return null;
 return Object.fromEntries(entries.sort(([a],[b])=>a.localeCompare(b)));
}
export function admitSyntheticCheckpoint({manifestRaw,trustedManifestSha256,observed}) {
 const failures=[];
 if(typeof manifestRaw!=='string' || Buffer.byteLength(manifestRaw)>1024*1024 || !digest(trustedManifestSha256) || sha(manifestRaw)!==trustedManifestSha256)
  return {status:'REJECT',failures:['UNTRUSTED_MANIFEST']};
 let manifest;try{manifest=JSON.parse(manifestRaw);}catch{return {status:'REJECT',failures:['INVALID_MANIFEST']};}
 if(manifest?.schema!==1 || !/^[a-f0-9]{32}$/.test(manifest.checkpointId||'') || !Number.isFinite(Date.parse(manifest.committedAt||'')))failures.push('INVALID_CHECKPOINT');
 if(manifest?.writerState!=='QUIESCED_COMMITTED')failures.push('WRITES_NOT_COMMITTED');
 if(!observed || observed.writerState!=='QUIESCED_COMMITTED')failures.push('OBSERVED_WRITE_IN_FLIGHT');
 if(!digest(manifest?.sqlSha256) || manifest.sqlSha256!==observed?.sqlSha256)failures.push('SQL_HASH_MISMATCH');
 for(const value of [manifest?.publication,manifest?.sqlPublication,observed?.publication,observed?.sqlPublication])if(!identity(value)){failures.push('INVALID_PUBLICATION');break;}
 if(!failures.includes('INVALID_PUBLICATION')){
  const expected=normalizedIdentity(manifest.publication);
  for(const value of [manifest.sqlPublication,observed.publication,observed.sqlPublication])
   if(!equal(expected,normalizedIdentity(value))){failures.push('CROSS_GENERATION_PUBLICATION');break;}
 }
 for(const category of ['current','history','dailyArchive','annual']){
  const expected=inventory(manifest?.files?.[category]),actual=inventory(observed?.files?.[category]);
  if(!expected || !actual || !equal(expected,actual))failures.push('INVENTORY_MISMATCH_'+category);
 }
 // A collector cannot declare unverified post-checkpoint revocations continuous.
 // Invalidation must be performed and verified by a separate restore coordinator.
 if(manifest?.revocationContinuity!=='PROVEN' || observed?.revocationContinuity!=='PROVEN')failures.push('REVOKE_ALL_BEFORE_ADMISSION');
 return {status:failures.length?'REJECT':'ADMIT_SCOPED',failures,checkpointId:manifest?.checkpointId};
}
