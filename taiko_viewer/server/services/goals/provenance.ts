import { createHash } from 'node:crypto';
import type { GoalProvenance } from '../../../utils/goalEvaluation.ts';
// Python ujson ensure_ascii=False / sort_keys=True also escapes forward slashes.
// Any unsupported encoding fails checksum validation rather than trusting metadata.
function canonical(value: any): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value).replace(/\//g, '\\/');
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(k=>`${canonical(k)}:${canonical(value[k])}`).join(',')}}`;
}
// Preserve numeric tokens (e.g. 1.0) from the Python-serialized file. Parsing
// through JS numbers first would invalidate a legitimate ujson checksum.
function canonicalRaw(raw: string): string {
  let offset = 0;
  const whitespace = () => { while (/\s/.test(raw[offset] || '') && offset < raw.length) offset++; };
  const string = () => { const start=offset++; while(offset<raw.length){const c=raw[offset++];if(c==='\\')offset++;else if(c==='"')return JSON.parse(raw.slice(start,offset));}throw Error('invalid-string'); };
  const value = (path:string[]):string => {
    whitespace();const c=raw[offset];
    if(c==='"')return canonical(string());
    if(c==='{' || c==='['){
      offset++;whitespace();const object=c==='{',end=object?'}':']';const entries:[string,string][]=[];const items:string[]=[];
      while(raw[offset]!==end){
        if(object){const key=string();whitespace();if(raw[offset++]!==':')throw Error('colon');const item=value([...path,key]);if(!(path.length===1&&path[0]==='_meta'&&key==='content_sha256'))entries.push([key,item]);}
        else items.push(value([...path,String(items.length)]));
        whitespace();if(raw[offset]===end)break;if(raw[offset++]!==',')throw Error('comma');whitespace();
      }
      offset++;return object?`{${entries.sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0).map(([k,v])=>`${canonical(k)}:${v}`).join(',')}}`:`[${items.join(',')}]`;
    }
    const match=/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(raw.slice(offset));
    if(!match)throw Error('scalar');offset+=match[0].length;return match[0];
  };
  const result=value([]);whitespace();if(offset!==raw.length)throw Error('trailing');return result;
}
export function verifiedGoalProvenance(payload: any, account: string, raw?: string): GoalProvenance | null {
  const meta = payload?._meta;
  if (String(payload?.profile?.userid || '') !== account) return null;
  if (!meta || meta.schema_version !== 2 || meta.full !== true || !['wahlap','hiroba'].includes(meta.source) || meta.source_account !== account || meta.imported_via || meta.importedVia || !Array.isArray(meta.merge_topology) || meta.merge_topology.length || !/^[a-f0-9]{64}$/.test(meta.content_sha256 || '')) return null;
  if (!/^\d{8}_\d{6}_\d{6}$/.test(meta.ts || '') || typeof meta.synced_at !== 'string') return null;
  const stamp = meta.ts;
  const observedAt = `${stamp.slice(0,4)}-${stamp.slice(4,6)}-${stamp.slice(6,8)}T${stamp.slice(9,11)}:${stamp.slice(11,13)}:${stamp.slice(13,15)}.${stamp.slice(16,19)}+08:00`;
  if (!Number.isFinite(Date.parse(observedAt)) || meta.synced_at.slice(0,19) !== observedAt.slice(0,19)) return null;
  const {content_sha256: hash, ...withoutHash} = meta;
  try { if (createHash('sha256').update(raw === undefined ? canonical({...payload,_meta:withoutHash}) : canonicalRaw(raw)).digest('hex') !== hash) return null; } catch { return null; }
  return {source:meta.source,account,topology:'[]',marker:stamp,observedAt:new Date(observedAt).toISOString(),contentHash:hash};
}
